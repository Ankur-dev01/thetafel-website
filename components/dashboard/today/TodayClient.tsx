'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePolling } from '@/lib/dashboard/usePolling';
import DisconnectedStrip from '@/components/dashboard/ui/DisconnectedStrip';
import StatTileRow from './StatTileRow';
import Timeline from './Timeline';
import OrderQueueSnapshot from './OrderQueueSnapshot';
import type { TodayPayload } from '@/lib/dashboard/queries/today';

const DEFAULT_POLL_MS = 60_000;

type TodayClientProps = {
  initial: TodayPayload;
  restaurantId: string;
  locale: 'nl' | 'en';
};

async function fetchTodayPayload(): Promise<TodayPayload> {
  const res = await fetch('/api/dashboard/today', { cache: 'no-store' });
  if (!res.ok) throw new Error(`today fetch failed: ${res.status}`);
  return res.json();
}

export default function TodayClient({ initial, restaurantId, locale }: TodayClientProps) {
  void restaurantId;

  // Test-only interval override so the D1.1 Playwright disconnect test
  // doesn't have to wait 3×60s for the backoff sequence. Never active in
  // production — see tests/e2e/dashboard/vandaag.spec.ts.
  const searchParams = useSearchParams();
  const pollMsParam = searchParams.get('pollMs');
  const intervalMs =
    process.env.NODE_ENV !== 'production' && pollMsParam
      ? Number(pollMsParam)
      : DEFAULT_POLL_MS;

  const handleData = useCallback((_data: TodayPayload) => {
    // usePolling already stores the latest payload in `data`; nothing extra
    // to do here today. Kept as an explicit no-op hook point for D1.2/D1.3,
    // which will react to alert/pause changes arriving via this same poll.
  }, []);

  const { data, isDisconnected, retry } = usePolling<TodayPayload>(fetchTodayPayload, {
    intervalMs,
    onData: handleData,
  });

  const payload = data ?? initial;

  return (
    <div className="flex flex-col gap-6 pt-4">
      {isDisconnected && <DisconnectedStrip onRetry={retry} locale={locale} />}
      <StatTileRow tiles={payload.tiles} />
      <Timeline bookings={payload.bookings} orders={payload.orders} nowIso={payload.now_iso} />
      <OrderQueueSnapshot orders={payload.orders} nowIso={payload.now_iso} locale={locale} />
    </div>
  );
}
