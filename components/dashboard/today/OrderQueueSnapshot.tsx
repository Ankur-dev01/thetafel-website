'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import SectionHeader from '@/components/dashboard/ui/SectionHeader';
import EntityCard from '@/components/dashboard/ui/EntityCard';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { formatRelativeMinutesFromNow } from '@/lib/dashboard/format/time';
import type { TodayOrder } from '@/lib/dashboard/queries/today';

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready', 'served']);

const currencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
});

const STATUS_TONE: Record<string, StatusTone> = {
  pending: 'neutral',
  confirmed: 'neutral',
  preparing: 'warning',
  ready: 'success',
  served: 'success',
};

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'status.pickup.received',
  confirmed: 'status.pickup.received',
  preparing: 'status.pickup.preparing',
  ready: 'status.pickup.ready',
  served: 'status.pickup.ready',
};

type OrderQueueSnapshotProps = {
  orders: TodayOrder[];
  nowIso: string;
  locale: 'nl' | 'en';
};

export default function OrderQueueSnapshot({ orders, nowIso, locale }: OrderQueueSnapshotProps) {
  const t = useTranslations('dashboard.today');
  const now = new Date(nowIso);

  const activeOrders = orders
    .filter((o) => ACTIVE_STATUSES.has(o.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  if (activeOrders.length === 0) return null;

  return (
    <div>
      <SectionHeader
        title={t('queue.title')}
        rightSlot={
          <Link
            href="/dashboard/orders"
            className="tafel-tap text-[12px] uppercase tracking-[0.08em] text-[#a86205]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('queue.viewAll')} →
          </Link>
        }
      />
      <div className="flex flex-col gap-2.5">
        {activeOrders.map((order) => (
          <EntityCard
            key={order.id}
            href={`/dashboard/orders/${order.id}`}
            title={`Bestelling ${order.order_ref}`}
            subtitle={`${order.order_type === 'qr' ? 'QR' : 'Afhaal'} · ${currencyFormatter.format(
              order.total_cents / 100
            )}`}
            meta={formatRelativeMinutesFromNow(order.created_at, now, locale)}
            status={
              <StatusChip
                tone={STATUS_TONE[order.status] ?? 'neutral'}
                label={t(STATUS_LABEL_KEY[order.status] ?? 'status.pickup.received')}
              />
            }
          />
        ))}
      </div>
    </div>
  );
}
