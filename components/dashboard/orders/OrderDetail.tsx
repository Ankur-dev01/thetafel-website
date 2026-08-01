'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { getOrderStatusMapping, nextAction } from '@/lib/dashboard/format/orderStatus';
import { formatCents } from '@/lib/dashboard/format/money';
import { formatDateTimeShort } from '@/lib/dashboard/date/amsterdamDay';
import { useOrderActions } from '@/lib/dashboard/actions/orderActions';
import CancelOrderDialog from './CancelOrderDialog';
import RefundOrderDialog from './RefundOrderDialog';
import type { OrderDetailPayload } from '@/lib/dashboard/queries/orders';
import type { OrderStatus } from '@/lib/orders/transitionOrderStatus';

const ERROR_KEYS = new Set([
  'invalid_body',
  'use_cancel_endpoint',
  'not_found',
  'illegal_transition',
  'already_advanced',
  'rate_limited',
  'db_error',
  'already_terminal',
  'use_refund',
  'not_completed',
  'not_paid',
]);

const CANCELABLE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

function isCancelable(status: OrderStatus): boolean {
  return CANCELABLE_STATUSES.includes(status);
}

function isRefundable(status: OrderStatus, paymentStatus: string): boolean {
  return status === 'completed' && paymentStatus === 'paid';
}

type OrderDetailProps = {
  payload: OrderDetailPayload;
  locale: 'nl' | 'en';
};

/** Best-effort render of the (currently unpopulated) `modifiers` jsonb column — shape isn't fixed anywhere yet. */
function renderModifiers(modifiers: unknown): string[] {
  if (!modifiers) return [];
  if (Array.isArray(modifiers)) {
    return modifiers
      .map((m) => (typeof m === 'string' ? m : typeof m === 'object' && m && 'name' in m ? String((m as { name: unknown }).name) : JSON.stringify(m)))
      .filter(Boolean);
  }
  if (typeof modifiers === 'object') {
    return Object.entries(modifiers as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`);
  }
  return [];
}

export default function OrderDetail({ payload, locale }: OrderDetailProps) {
  const t = useTranslations('dashboard.orders');
  const { order, items } = payload;

  const statusMapping = getOrderStatusMapping(order.status);
  const action = nextAction(order.status, order.order_type);
  const showUnpaid = order.payment_status === 'pending';
  const { advance, cancel, refund, pending, error } = useOrderActions(order.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  async function handleCancelConfirm(reason?: string) {
    const result = await cancel(reason);
    if (result.ok) setCancelOpen(false);
  }

  async function handleRefundConfirm(reason?: string) {
    const result = await refund(reason);
    if (result.ok) setRefundOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[20px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
          >
            #{order.order_ref}
          </span>
          <StatusChip tone="neutral" label={t(`type.${order.order_type}`)} />
          <StatusChip tone={statusMapping.tone} label={t(`status.${order.status}`)} />
          {showUnpaid && <StatusChip tone="danger" label={t('card.unpaid')} />}
        </div>
        <p className="text-[13px] text-[#6f6353]">{t('detail.timing.created', { when: formatDateTimeShort(order.created_at, locale) })}</p>
      </div>

      <div>
        <div
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {order.order_type === 'qr'
            ? order.table_label
              ? t('card.table', { label: order.table_label })
              : '—'
            : order.guest_name || '—'}
        </div>
        {order.order_type === 'takeaway' && order.guest_phone && (
          <a
            href={`tel:${order.guest_phone}`}
            className="tafel-tap text-[13px] text-[#a86205] underline underline-offset-2"
          >
            {order.guest_phone}
          </a>
        )}
      </div>

      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.items.title')}
        </h3>
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const modifierLines = renderModifiers(item.modifiers);
            return (
              <div key={item.id} className="flex flex-col gap-0.5" data-testid="order-detail-item">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[14px] text-[#1e1508]"
                    style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
                  >
                    {item.quantity}× {item.name_snapshot}
                  </span>
                  <span
                    className="text-[14px] text-[#1e1508]"
                    style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
                  >
                    {formatCents(item.line_total_cents)}
                  </span>
                </div>
                {modifierLines.length > 0 && (
                  <ul className="text-[12px] text-[#8c8577] list-disc list-inside">
                    {modifierLines.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                )}
                {item.item_notes && (
                  <p className="text-[12px] text-[#8c8577] italic">{item.item_notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-3 border-t border-[#e7ddc9]">
        <div className="flex items-center justify-between text-[13px] text-[#6f6353]">
          <span>{t('detail.subtotal')}</span>
          <span>{formatCents(order.subtotal_cents)}</span>
        </div>
        {order.vat_cents > 0 && (
          <div className="flex items-center justify-between text-[13px] text-[#6f6353]">
            <span>{t('detail.vat')}</span>
            <span>{formatCents(order.vat_cents)}</span>
          </div>
        )}
        <div
          className="flex items-center justify-between text-[15px] text-[#1e1508] pt-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        >
          <span>{t('detail.total')}</span>
          <span>{formatCents(order.total_cents)}</span>
        </div>
      </div>

      {order.guest_note && (
        <div>
          <h3
            className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('detail.notes')}
          </h3>
          <p className="text-[13px] text-[#6f6353] italic">{order.guest_note}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap gap-2">
        {action && (
          <button
            type="button"
            onClick={() => !pending && advance(action.to)}
            disabled={pending}
            data-testid="detail-order-next-action"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {pending ? '…' : t(`action.${action.key}`)}
          </button>
        )}
        {isCancelable(order.status) && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            disabled={pending}
            data-testid="detail-order-cancel"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('action.cancel')}
          </button>
        )}
        {isRefundable(order.status, order.payment_status) && (
          <button
            type="button"
            onClick={() => setRefundOpen(true)}
            disabled={pending}
            data-testid="detail-order-refund"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('action.refund')}
          </button>
        )}
        </div>
        {error && (
          <p className="text-[12px] text-[#b3422f]" data-testid="detail-order-action-error">
            {t(`action.error.${ERROR_KEYS.has(error) ? error : 'unknown'}`)}
          </p>
        )}
      </div>

      <CancelOrderDialog
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
        pending={pending}
        paymentStatus={order.payment_status as 'pending' | 'paid' | 'open_tab' | 'refunded'}
        totalCents={order.total_cents}
        locale={locale}
      />
      <RefundOrderDialog
        open={refundOpen}
        onCancel={() => setRefundOpen(false)}
        onConfirm={handleRefundConfirm}
        pending={pending}
        totalCents={order.total_cents}
        locale={locale}
      />
    </div>
  );
}
