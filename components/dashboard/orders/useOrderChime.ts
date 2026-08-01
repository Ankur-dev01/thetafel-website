'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useOrderChime — new-order detection + Web Audio bell + localStorage toggle.
 *
 * The toggle button lives in DashboardHeader (always mounted) while the
 * new-order check lives in OrdersClient (mounted only on /dashboard/orders,
 * as page children — a sibling tree, not a descendant, of the header). Since
 * a click in one tree must be reflected in the other within the same tab,
 * `enabled` is synced via a same-tab custom event — localStorage's own
 * 'storage' event only fires in *other* tabs, never the one that wrote it.
 *
 * Chime never plays on initial load: `lastSeenRef` is seeded with the
 * server-rendered payload's `server_max_created_at`, and reading the stored
 * enabled flag on mount never calls `setEnabled` (only the direct read) —
 * so a page load with chime already enabled from a prior session, with
 * orders already present, plays nothing. Only an explicit `setEnabled(true)`
 * call (the toggle's onClick) plays the confirmation chime — never a mount
 * or a cross-tree sync.
 */

const STORAGE_KEY = 'tafel.dashboard.orders.chime';
const TOGGLE_EVENT = 'tafel:chime-toggled';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

/** Two-tone bell: 880Hz + 1318Hz (A5 + E6). Fast attack, ~450ms exponential decay. */
function playBellTones(ctx: AudioContext): void {
  const now = ctx.currentTime;
  for (const freq of [880, 1318]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }
}

/**
 * Play the bell and dispatch the `tafel:chime-played` hook Playwright
 * listens for. Exported standalone (not tied to a hook instance) so both
 * the header's toggle and the orders-page poll check can trigger it.
 */
export function playChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    playBellTones(ctx);
    window.dispatchEvent(new CustomEvent('tafel:chime-played'));
  } catch {
    // Autoplay/audio errors are swallowed — chime is a nice-to-have.
  }
}

function readStoredEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredEnabled(next: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // ignore — setting just won't persist this session
  }
  window.dispatchEvent(new CustomEvent<boolean>(TOGGLE_EVENT, { detail: next }));
}

/**
 * Cross-component enabled flag. Used directly by ChimeToggle/DashboardHeader
 * for the button's own state, and wrapped by `useOrderChime` below for the
 * polling page — both reflect the same underlying localStorage value.
 */
export function useChimeEnabledState(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    setEnabledState(readStoredEnabled());
    function onToggle(e: Event) {
      setEnabledState((e as CustomEvent<boolean>).detail);
    }
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    writeStoredEnabled(next);
    // The enabling click is the user gesture that unlocks autoplay — play a
    // test chime immediately to confirm audio works and consume that gesture.
    if (next) playChime();
  }, []);

  return [enabled, setEnabled];
}

export type UseOrderChimeOptions = {
  initialMaxCreatedAt: string | null;
};

export function useOrderChime({ initialMaxCreatedAt }: UseOrderChimeOptions) {
  const [enabled, setEnabled] = useChimeEnabledState();
  const lastSeenRef = useRef<string | null>(initialMaxCreatedAt);

  const check = useCallback(
    (newMaxCreatedAt: string | null, _activeCount: number) => {
      void _activeCount;
      const isNewer =
        newMaxCreatedAt !== null &&
        (lastSeenRef.current === null || newMaxCreatedAt > lastSeenRef.current);
      if (isNewer && enabled) {
        playChime();
      }
      if (newMaxCreatedAt) lastSeenRef.current = newMaxCreatedAt;
    },
    [enabled],
  );

  return { enabled, setEnabled, check };
}
