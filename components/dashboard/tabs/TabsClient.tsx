'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePolling } from '@/lib/dashboard/usePolling';
import { useTabActions } from '@/lib/dashboard/actions/tabActions';
import DisconnectedStrip from '@/components/dashboard/ui/DisconnectedStrip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import { Receipt } from '@/components/dashboard/icons';
import StatTileRow from './StatTileRow';
import TabFilterChips, { type TabFilter } from './TabFilterChips';
import TabCard from './TabCard';
import TabDetail from './TabDetail';
import CloseTabDialog from './CloseTabDialog';
import WriteOffDialog from './WriteOffDialog';
import type { TabsPayload, TabDetailPayload, OpenTab } from '@/lib/dashboard/queries/tabs';

const DEFAULT_POLL_MS = 30_000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

type TabsClientProps = {
  initial: TabsPayload;
  locale: 'nl' | 'en';
  initialFilter: TabFilter;
  selectedTab: TabDetailPayload | null;
};

async function fetchTabsPayload(): Promise<TabsPayload> {
  const res = await fetch('/api/dashboard/tabs', { cache: 'no-store' });
  if (!res.ok) throw new Error(`tabs fetch failed: ${res.status}`);
  return res.json();
}

function isStale(tab: OpenTab, now: Date): boolean {
  return now.getTime() - new Date(tab.opened_at).getTime() > FOUR_HOURS_MS;
}

// Card-level settle/write-off dialogs are driven from here (not TabCard
// itself) so a click on the list opens the same dialog components the
// detail panel uses, without each card owning its own useTabActions state.
function CardActions({ tab, now, locale }: { tab: OpenTab; now: Date; locale: 'nl' | 'en' }) {
  const { closeTabPaidAtTable, writeOffTab, pending } = useTabActions(tab.id);
  const [settleOpen, setSettleOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  async function handleSettleConfirm() {
    const result = await closeTabPaidAtTable();
    if (result.ok) setSettleOpen(false);
  }

  async function handleWriteOffConfirm(reason: string) {
    const result = await writeOffTab(reason);
    if (result.ok) setWriteOffOpen(false);
  }

  return (
    <>
      <TabCard tab={tab} now={now} locale={locale} onSettle={() => setSettleOpen(true)} onWriteOff={() => setWriteOffOpen(true)} />
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
    </>
  );
}

export default function TabsClient({ initial, locale, initialFilter, selectedTab }: TabsClientProps) {
  const t = useTranslations('dashboard.tabs');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pollMsParam = searchParams.get('pollMs');
  const intervalMs = process.env.NODE_ENV !== 'production' && pollMsParam ? Number(pollMsParam) : DEFAULT_POLL_MS;

  const { data, isDisconnected, retry } = usePolling<TabsPayload>(fetchTabsPayload, {
    intervalMs,
    onData: () => {},
  });

  const payload = data ?? initial;
  const now = new Date(payload.now_iso);

  const pushFilter = useCallback(
    (next: TabFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('filter');
      else params.set('filter', next);
      params.delete('tab');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  function closeDetail() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const staleTabs = useMemo(() => payload.tabs.filter((tab) => isStale(tab, now)), [payload.tabs, now]);
  const filteredTabs = initialFilter === 'stale' ? staleTabs : payload.tabs;

  const counts = useMemo(
    () => ({ all: payload.tabs.length, stale: staleTabs.length }),
    [payload.tabs.length, staleTabs.length],
  );

  return (
    <div className="flex flex-col gap-4 pt-2">
      {isDisconnected && <DisconnectedStrip onRetry={retry} locale={locale} />}

      <StatTileRow openCount={payload.totals.open_count} outstandingCents={payload.totals.outstanding_cents} staleCount={payload.totals.stale_count} />

      <TabFilterChips value={initialFilter} onChange={pushFilter} counts={counts} />

      <div>
        <div className="flex flex-col gap-2.5">
          {filteredTabs.length === 0 ? (
            <EmptyState illustration={<Receipt width={48} height={48} />} heading={t('empty.title')} body={t('empty.body')} />
          ) : (
            filteredTabs.map((tab) => <CardActions key={tab.id} tab={tab} now={now} locale={locale} />)
          )}
        </div>

        {selectedTab && (
          <>
            <div className="hidden md:block" data-testid="tab-detail-desktop">
              <DetailPanel title={t('card.table', { label: selectedTab.tab.table_label ?? '—' })} onClose={closeDetail}>
                <TabDetail payload={selectedTab} now={now} locale={locale} />
              </DetailPanel>
            </div>
            <div className="md:hidden" data-testid="tab-detail-phone">
              <DetailSheet open onClose={closeDetail} title={t('card.table', { label: selectedTab.tab.table_label ?? '—' })}>
                <TabDetail payload={selectedTab} now={now} locale={locale} />
              </DetailSheet>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
