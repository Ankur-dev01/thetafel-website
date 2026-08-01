'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePolling } from '@/lib/dashboard/usePolling';
import DisconnectedStrip from '@/components/dashboard/ui/DisconnectedStrip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import { Plate } from '@/components/dashboard/icons';
import OrderFilterChips, { type OrderTypeFilter } from './OrderFilterChips';
import CompletedDisclosure from './CompletedDisclosure';
import OrderCard from './OrderCard';
import OrderDetail from './OrderDetail';
import { useOrderChime } from './useOrderChime';
import type { OrdersPayload, OrderDetailPayload, OrderListRow } from '@/lib/dashboard/queries/orders';

const DEFAULT_POLL_MS = 30_000;

type OrdersClientProps = {
  initial: OrdersPayload;
  restaurantId: string;
  locale: 'nl' | 'en';
  initialType: OrderTypeFilter;
  initialTab: 'active' | 'completed';
  selectedOrder: OrderDetailPayload | null;
};

async function fetchOrdersPayload(): Promise<OrdersPayload> {
  const res = await fetch('/api/dashboard/orders', { cache: 'no-store' });
  if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
  return res.json();
}

function matchesType(order: OrderListRow, type: OrderTypeFilter): boolean {
  if (type === 'all') return true;
  return order.order_type === type;
}

export default function OrdersClient({
  initial,
  restaurantId,
  locale,
  initialType,
  initialTab,
  selectedOrder,
}: OrdersClientProps) {
  void restaurantId;
  const t = useTranslations('dashboard.orders');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pollMsParam = searchParams.get('pollMs');
  const intervalMs =
    process.env.NODE_ENV !== 'production' && pollMsParam ? Number(pollMsParam) : DEFAULT_POLL_MS;

  const chime = useOrderChime({ initialMaxCreatedAt: initial.server_max_created_at });

  const handleData = useCallback(
    (data: OrdersPayload) => {
      chime.check(data.server_max_created_at, data.active.length);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const { data, isDisconnected, retry } = usePolling<OrdersPayload>(fetchOrdersPayload, {
    intervalMs,
    onData: handleData,
  });

  const payload = data ?? initial;
  const now = new Date(payload.now_iso);

  function pushParams(next: { type?: OrderTypeFilter; tab?: 'active' | 'completed' }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.type !== undefined) {
      if (next.type === 'all') params.delete('type');
      else params.set('type', next.type);
    }
    if (next.tab !== undefined) {
      if (next.tab === 'active') params.delete('tab');
      else params.set('tab', next.tab);
    }
    params.delete('order');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function closeDetail() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('order');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const filteredActive = useMemo(
    () => payload.active.filter((o) => matchesType(o, initialType)),
    [payload.active, initialType],
  );
  const filteredCompleted = useMemo(
    () => payload.completedToday.filter((o) => matchesType(o, initialType)),
    [payload.completedToday, initialType],
  );

  const counts = useMemo(
    () => ({
      all: payload.active.length,
      qr: payload.active.filter((o) => o.order_type === 'qr').length,
      takeaway: payload.active.filter((o) => o.order_type === 'takeaway').length,
    }),
    [payload.active],
  );

  const activeSection = (
    <div className="flex flex-col gap-2.5">
      {filteredActive.length === 0 ? (
        <EmptyState
          illustration={<Plate width={48} height={48} />}
          heading={t('empty.active.title')}
          body={t('empty.active.body')}
        />
      ) : (
        filteredActive.map((order) => <OrderCard key={order.id} order={order} now={now} locale={locale} />)
      )}
    </div>
  );

  const completedListItems =
    filteredCompleted.length === 0 ? (
      <p className="text-[13px] text-[#8c8577] px-1">{t('empty.completed')}</p>
    ) : (
      filteredCompleted.map((order) => <OrderCard key={order.id} order={order} now={now} locale={locale} />)
    );

  // Desktop: collapsed-by-default <details> disclosure. Phone: the "Voltooid"
  // tab itself IS the disclosure — rendering the same list again inside a
  // *second*, separately-collapsed <details> would hide it until a further
  // manual expand, so phone gets the bare list instead.
  const completedSection = (
    <>
      <div className="hidden md:block">
        <CompletedDisclosure count={filteredCompleted.length}>{completedListItems}</CompletedDisclosure>
      </div>
      <div className="md:hidden flex flex-col gap-2.5">{completedListItems}</div>
    </>
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {isDisconnected && <DisconnectedStrip onRetry={retry} locale={locale} />}

      <OrderFilterChips value={initialType} onChange={(type) => pushParams({ type })} counts={counts} />

      <div className="md:hidden flex gap-2">
        {(['active', 'completed'] as const).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => pushParams({ tab: tabKey })}
            className={
              'tafel-tap flex-1 px-3.5 py-2 rounded-full text-[13px] whitespace-nowrap transition-colors ' +
              (initialTab === tabKey ? 'bg-amber text-[#1e1508]' : 'bg-[#f5ede0] text-[#6f6353]')
            }
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {tabKey === 'active' ? t('tab.active') : t('tab.completed', { count: filteredCompleted.length })}
          </button>
        ))}
      </div>

      <div className={selectedOrder ? 'grid md:grid-cols-[60%_40%] gap-4 items-start' : ''}>
        <div className="md:grid md:grid-cols-2 md:gap-6 flex flex-col gap-4">
          <div className={initialTab === 'active' ? 'block' : 'hidden md:block'}>{activeSection}</div>
          <div className={initialTab === 'completed' ? 'block' : 'hidden md:block'}>{completedSection}</div>
        </div>

        {selectedOrder && (
          <>
            <div className="hidden md:block" data-testid="order-detail-desktop">
              <DetailPanel title={`#${selectedOrder.order.order_ref}`}>
                <OrderDetail payload={selectedOrder} locale={locale} />
              </DetailPanel>
            </div>
            <div className="md:hidden" data-testid="order-detail-phone">
              <DetailSheet open onClose={closeDetail} title={`#${selectedOrder.order.order_ref}`}>
                <OrderDetail payload={selectedOrder} locale={locale} />
              </DetailSheet>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
