'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * usePolling — client polling hook with exponential backoff.
 *
 * Fetches on mount, then every `intervalMs`. On failure, backs off
 * (2s → 5s → 15s → 30s cap) instead of hammering the failing endpoint.
 * After 3 consecutive failures, `isDisconnected` flips true so the caller
 * can render the "Verbinding verbroken" strip. Forces an immediate poll
 * when the window regains focus; pauses entirely while the tab is hidden.
 */

const BACKOFF_STEPS_MS = [2000, 5000, 15000, 30000];
const DISCONNECT_THRESHOLD = 3;

export type UsePollingOptions<T> = {
  intervalMs: number;
  onData: (data: T) => void;
  onError?: (err: unknown) => void;
};

export type UsePollingResult<T> = {
  data: T | null;
  isDisconnected: boolean;
  retry: () => void;
};

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: UsePollingOptions<T>
): UsePollingResult<T> {
  const { intervalMs, onData, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [isDisconnected, setIsDisconnected] = useState(false);

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const failureCountRef = useRef(0);
  const pausedRef = useRef(false);

  const clearScheduled = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runOnce = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const result = await fetchFnRef.current();
      if (ac.signal.aborted) return;
      failureCountRef.current = 0;
      setIsDisconnected(false);
      setData(result);
      onDataRef.current(result);
    } catch (err) {
      if (ac.signal.aborted) return;
      failureCountRef.current += 1;
      if (failureCountRef.current >= DISCONNECT_THRESHOLD) {
        setIsDisconnected(true);
      }
      onErrorRef.current?.(err);
    } finally {
      if (!ac.signal.aborted && !pausedRef.current) {
        scheduleNext();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleNext = useCallback(() => {
    clearScheduled();
    const failures = failureCountRef.current;
    const delay =
      failures === 0
        ? intervalMs
        : BACKOFF_STEPS_MS[Math.min(failures - 1, BACKOFF_STEPS_MS.length - 1)];
    timeoutRef.current = window.setTimeout(() => {
      void runOnce();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  const retry = useCallback(() => {
    failureCountRef.current = 0;
    setIsDisconnected(false);
    clearScheduled();
    void runOnce();
  }, [clearScheduled, runOnce]);

  useEffect(() => {
    pausedRef.current = false;
    void runOnce();

    function onVisibilityChange() {
      if (document.hidden) {
        pausedRef.current = true;
        clearScheduled();
        abortRef.current?.abort();
      } else {
        pausedRef.current = false;
        void runOnce();
      }
    }

    function onFocus() {
      if (!document.hidden) {
        clearScheduled();
        void runOnce();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);

    return () => {
      pausedRef.current = true;
      clearScheduled();
      abortRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, isDisconnected, retry };
}
