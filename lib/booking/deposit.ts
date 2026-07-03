// lib/booking/deposit.ts
//
// C4.7B — deposit gating logic. Extends the threshold-only check from
// depositAppliesForParty (lib/booking/types.ts) with the day/time window
// check that was deferred to this unit.
//
// Window shape (lib/booking/types.ts NoShowPrepayWindow, jsonb, currently
// always NULL in the live DB — onboarding's no-show step does not yet expose
// a UI to set specific days/times; see TheTafel_Onboarding_BuildPlan_v1.0.md
// §D3.5). When present, the expected shape is:
//   { days: number[] (1=Mon..7=Sun, ISO), startTime: "HH:MM", endTime: "HH:MM" }
// A NULL or malformed window means "no restriction" — deposit applies on
// every day/time once threshold + enabled conditions are met. This matches
// the current DB reality and is the safe default: nothing breaks for a
// restaurant that only has threshold + amount configured (all of them today).

import { depositAppliesForParty } from './types';
import type { BookingConfig, NoShowPrepayWindow } from './types';

interface ParsedWindow {
  days: number[]; // ISO weekday numbers, 1 (Mon) .. 7 (Sun)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

function parseWindow(window: NoShowPrepayWindow): ParsedWindow | null {
  if (!window || typeof window !== 'object') return null;
  const w = window as Record<string, unknown>;
  const days = w.days;
  const startTime = w.startTime;
  const endTime = w.endTime;
  if (
    !Array.isArray(days) ||
    days.length === 0 ||
    !days.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7) ||
    typeof startTime !== 'string' ||
    typeof endTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
  ) {
    return null;
  }
  return { days: days as number[], startTime, endTime };
}

/**
 * Whether the given UTC slot instant falls inside the restaurant's
 * configured deposit window, evaluated in Europe/Amsterdam local time.
 * Returns true (no restriction) if no valid window is configured.
 */
export function slotMatchesDepositWindow(
  window: NoShowPrepayWindow,
  slotInstantIso: string,
): boolean {
  const parsed = parseWindow(window);
  if (!parsed) return true; // no restriction configured — always matches

  const slot = new Date(slotInstantIso);

  const isoWeekday = getIsoWeekdayInAmsterdam(slot);
  if (!parsed.days.includes(isoWeekday)) return false;

  const hm = getHourMinuteInAmsterdam(slot);
  return hm >= parsed.startTime && hm <= parsed.endTime;
}

function getIsoWeekdayInAmsterdam(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
  });
  const short = fmt.format(date); // "Mon", "Tue", ...
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[short] ?? 1;
}

function getHourMinuteInAmsterdam(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(date); // "HH:MM"
}

/**
 * Full deposit applicability check: enabled + amount configured + threshold
 * met + (if configured) the slot falls inside the deposit window.
 *
 * `slotInstantIso` is optional so callers that only know the party size yet
 * (e.g. very early UI state) can still get a threshold-only answer — pass it
 * whenever available for the complete check.
 */
export function depositApplies(
  config: BookingConfig,
  partySize: number,
  slotInstantIso?: string | null,
): boolean {
  if (!depositAppliesForParty(config, partySize)) return false;
  if (!slotInstantIso) return true;
  return slotMatchesDepositWindow(config.noShowPrepaidWindow, slotInstantIso);
}

/**
 * Server-authoritative deposit amount in cents for a party of this size.
 * Never trust a client-sent amount (PRD §14.8) — always recompute this.
 */
export function computeDepositAmountCents(config: BookingConfig, partySize: number): number {
  const perGuest = config.noShowPrepaidAmountCents ?? 0;
  return perGuest * partySize;
}
