import { useTranslations } from 'next-intl';
import StatTile from '@/components/dashboard/ui/StatTile';
import { formatCents } from '@/lib/dashboard/format/money';

type StatTileRowProps = {
  openCount: number;
  outstandingCents: number;
  staleCount: number;
};

export default function StatTileRow({ openCount, outstandingCents, staleCount }: StatTileRowProps) {
  const t = useTranslations('dashboard.tabs.tile');

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label={t('open.label')} value={openCount} delta={{ text: formatCents(outstandingCents), tone: 'neutral' }} />
      <StatTile
        label={t('stale.label')}
        value={staleCount}
        delta={{
          text: staleCount > 0 ? t('stale.needsAttention') : t('stale.allClear'),
          tone: staleCount > 0 ? 'negative' : 'positive',
        }}
      />
    </div>
  );
}
