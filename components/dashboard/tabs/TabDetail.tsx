'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { getOrderStatusMapping } from '@/lib/dashboard/format/orderStatus';
import { formatCents } from '@/lib/dashboard/format/money';
import { formatElapsedHoursMinutes } from '@/lib/dashboard/format/time';
import { formatDateTimeShort } from '@/lib/dashboard/date/amsterdamDay';
import { useTabActions } from '@/lib/dashboard/actions/tabActions';
import CloseTabDialog from './CloseTabDialog';
import WriteOffDialog from './WriteOffDialog';
import type { TabDetailPayload } from '@/lib/dashboard/queries/tabs';

const ERROR_KEYS = new Set(['invalid_body', 'reason_required', 'not_found', 'already_closed', 'rate_limited', 'db_error']);

type TabDetailProps = {
  payload: TabDetailPayload;
  now: Date;
  locale: 'nl' | 'en';
};

export default function TabDetail({ payload, now, locale }: TabDetailProps) {
  const t = useTranslations('dashboard.tabs');
  // Order type/status chip labels are the D3.1 order-status vocabulary — reused
  // rather than duplicated under dashboard.tabs.*.
  const tOrders = useTranslations('dashboard.orders');
  const { tab, orders } = payload;
  const { closeTabPaidAtTable, writeOffTab, pending, error } = useTabActions(tab.id);
  const [settleOpen, setSettleOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const isOpen = tab.status === 'open';
  const elapsed = formatElapsedHoursMinutes(tab.opened_at, now, locale);

  const totals = orders.reduce(
    (acc, o) => ({
      subtotal: acc.subtotal + o.subtotal_cents,
      vat: acc.vat + o.vat_cents,
      total: acc.total + o.total_cents,
    }),
    { subtotal: 0, vat: 0, total: 0 },
  );

  async function handleSettleConfirm() {
    const result = await closeTabPaidAtTable();
    if (result.ok) setSettleOpen(false);
  }

  async function handleWriteOffConfirm(reason: string) {
    const result = await writeOffTab(reason);
    if (result.ok) setWriteOffOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {!isOpen && (
        <div className="text-[13px] text-[#6f6353] bg-[#f5ede0] rounded-lg px-3 py-2">
          {tab.settlement === 'written_off'
            ? t('detail.closedBanner.writeOff', {
                date: tab.closed_at ? formatDateTimeShort(tab.closed_at, locale) : '—',
                name: tab.closed_by_display_name ?? '—',
              })
            : t('detail.closedBanner.settled', {
                date: tab.closed_at ? formatDateTimeShort(tab.closed_at, locale) : '—',
                name: tab.closed_by_display_name ?? '—',
              })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="text-[20px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {t('card.table', { label: tab.table_label ?? '—' })}
        </span>
        <StatusChip tone={isOpen && now.getTime() - new Date(tab.opened_at).getTime() > 4 * 3600_000 ? 'warning' : 'neutral'} label={elapsed} />
      </div>
      <div
        className="text-[24px] text-[#1e1508] -mt-3"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
      >
        {formatCents(tab.total_cents)}
      </div>

      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.08em] text-[#8c8577] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('detail.orders')}
        </h3>
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const statusMapping = getOrderStatusMapping(order.status);
            return (
              <div key={order.id} className="flex flex-col gap-1.5 pb-3 border-b border-[#f0e8d8] last:border-0 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2.5 py-1 rounded-full bg-[#f5ede0] text-[#1e1508] text-[13px]"
                    style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
                  >
                    #{order.order_ref}
                  </span>
                  <StatusChip tone="neutral" label={tOrders(`type.${order.order_type}`)} />
                  <StatusChip tone={statusMapping.tone} label={tOrders(`status.${order.status}`)} />
                </div>
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}>
                      {item.quantity}× {item.name_snapshot}
                    </span>
                    <span className="text-[#1e1508]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}>
                      {formatCents(item.line_total_cents)}
                    </span>
                  </div>
                ))}
                {order.guest_note && (
                  <p className="text-[12px] text-[#8c8577] italic">{order.guest_note}</p>
                )}
                <div className="flex items-center justify-between text-[13px] text-[#6f6353] pt-1">
                  <span>{t('detail.subtotal')}</span>
                  <span>{formatCents(order.subtotal_cents)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-3 border-t border-[#e7ddc9]">
        <div className="flex items-center justify-between text-[13px] text-[#6f6353]">
          <span>{t('detail.subtotal')}</span>
          <span>{formatCents(totals.subtotal)}</span>
        </div>
        {totals.vat > 0 && (
          <div className="flex items-center justify-between text-[13px] text-[#6f6353]">
            <span>{t('detail.vat')}</span>
            <span>{formatCents(totals.vat)}</span>
          </div>
        )}
        <div
          className="flex items-center justify-between text-[15px] text-[#1e1508] pt-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        >
          <span>{t('detail.total')}</span>
          <span>{formatCents(totals.total)}</span>
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSettleOpen(true)}
              disabled={pending}
              data-testid="tab-detail-settle"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('action.settle')}
            </button>
            <button
              type="button"
              onClick={() => setWriteOffOpen(true)}
              disabled={pending}
              data-testid="tab-detail-writeoff"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('action.writeOff')}
            </button>
          </div>
          {error && (
            <p className="text-[12px] text-[#b3422f]" data-testid="tab-detail-action-error">
              {t(`error.${ERROR_KEYS.has(error) ? error : 'db_error'}`)}
            </p>
          )}
        </div>
      )}

      <CloseTabDialog
        open={settleOpen}
        onCancel={() => setSettleOpen(false)}
        onConfirm={handleSettleConfirm}
        pending={pending}
        totalCents={tab.total_cents}
        locale={locale}
      />
      <WriteOffDialog
        open={writeOffOpen}
        onCancel={() => setWriteOffOpen(false)}
        onConfirm={handleWriteOffConfirm}
        pending={pending}
        totalCents={tab.total_cents}
        locale={locale}
      />
    </div>
  );
}
