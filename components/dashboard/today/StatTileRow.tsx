import { useTranslations } from 'next-intl';
import StatTile from '@/components/dashboard/ui/StatTile';
import type { TodayPayload } from '@/lib/dashboard/queries/today';

const currencyFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
});

function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

type StatTileRowProps = {
  tiles: TodayPayload['tiles'];
};

/**
 * TODO(D1.next): last-week comparison deltas ("3 meer dan vorige week", PRD
 * §4.1) need a second query against the same restaurant_id for the prior
 * week's tile values, gated on the restaurant having at least 7 days of
 * history. StatTile's single `delta` slot currently carries the always-on
 * meta line (couverts / revenue / outstanding total) below each value; once
 * real week-over-week comparisons exist, this row needs a second text line
 * rather than swapping the meta line out.
 */
export default function StatTileRow({ tiles }: StatTileRowProps) {
  const t = useTranslations('dashboard.today');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div data-testid="tile-bookings">
        <StatTile
          label={t('tiles.bookings.label')}
          value={tiles.bookings.count}
          delta={{
            text: t('tiles.bookings.covers', { count: tiles.bookings.covers }),
            tone: 'neutral',
          }}
          href="/dashboard/bookings"
        />
      </div>
      <div data-testid="tile-orders">
        <StatTile
          label={t('tiles.orders.label')}
          value={tiles.orders.count}
          delta={{ text: formatCents(tiles.orders.revenue_cents), tone: 'neutral' }}
          href="/dashboard/orders"
        />
      </div>
      <div data-testid="tile-tabs">
        <StatTile
          label={t('tiles.tabs.label')}
          value={tiles.open_tabs.count}
          delta={{ text: formatCents(tiles.open_tabs.total_cents), tone: 'neutral' }}
          href="/dashboard/tabs"
        />
      </div>
      <div data-testid="tile-expected">
        <StatTile
          label={t('tiles.expected.label')}
          value={tiles.expected_guests.covers}
          href="/dashboard/bookings?filter=upcoming"
        />
      </div>
    </div>
  );
}
