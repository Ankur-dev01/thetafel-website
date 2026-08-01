'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { getOrderStatusMapping, nextAction } from '@/lib/dashboard/format/orderStatus';
import { formatRelativeMinutesFromNow } from '@/lib/dashboard/format/time';
import { formatCents } from '@/lib/dashboard/format/money';
import { useOrderActions } from '@/lib/dashboard/actions/orderActions';
import type { OrderListRow } from '@/lib/dashboard/queries/orders';

const ERROR_KEYS = new Set([
  'invalid_body',
  'use_cancel_endpoint',
  'not_found',
  'illegal_transition',
  'already_advanced',
  'rate_limited',
  'db_error',
]);

type OrderCardProps = {
  order: OrderListRow;
  now: Date;
  locale: 'nl' | 'en';
};

export default function OrderCard({ order, now, locale }: OrderCardProps) {
  const t = useTranslations('dashboard.orders');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('order', order.id);
  const href = `${pathname}?${params.toString()}`;

  const statusMapping = getOrderStatusMapping(order.status);
  const action = nextAction(order.status, order.order_type);
  const showUnpaid = order.payment_status === 'pending';
  const { advance, pending, error } = useOrderActions(order.id);

  async function handleActionClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!action || pending) return;
    await advance(action.to);
  }

  return (
    <Link href={href} className="tafel-tap block" data-testid={`order-card-${order.id}`}>
      <div className="bg-white rounded-card p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="px-2.5 py-1 rounded-full bg-[#f5ede0] text-[#1e1508] text-[13px] flex-shrink-0"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
            >
              #{order.order_ref}
            </span>
            <StatusChip tone="neutral" label={t(`type.${order.order_type}`)} />
          </div>
          <StatusChip tone={statusMapping.tone} label={t(`status.${order.status}`)} />
        </div>

        <div
          className="text-[15px] text-[#1e1508] truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {order.order_type === 'qr'
            ? order.table_label
              ? t('card.table', { label: order.table_label })
              : '—'
            : order.guest_name || '—'}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[13px] text-[#6f6353]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {t('card.itemCount', { count: order.item_count })}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="text-[14px] text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {formatCents(order.total_cents)}
            </span>
            {showUnpaid && <StatusChip tone="danger" label={t('card.unpaid')} />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#8c8577]">
            {formatRelativeMinutesFromNow(order.created_at, now, locale)}
          </span>
          {action && (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleActionClick}
                disabled={pending}
                data-testid={`order-action-${order.id}`}
                className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
              >
                {pending ? '…' : t(`action.${action.key}`)}
              </button>
              {error && (
                <span className="text-[11px] text-[#b3422f] max-w-[180px] text-right leading-snug">
                  {t(`action.error.${ERROR_KEYS.has(error) ? error : 'unknown'}`)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
