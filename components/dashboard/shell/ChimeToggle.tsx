'use client';

import { useTranslations } from 'next-intl';
import { Bell } from '@/components/dashboard/icons';

type ChimeToggleProps = {
  enabled: boolean;
  onToggle: (next: boolean) => void;
};

/**
 * Header bell button — visible only on /dashboard/orders (DashboardHeader
 * decides that). Muted: outline bell, no accent. Enabled: filled bell,
 * amber. The click that enables it is also the user gesture the browser's
 * autoplay policy requires — useOrderChime plays a test chime on that same
 * click.
 */
export default function ChimeToggle({ enabled, onToggle }: ChimeToggleProps) {
  const t = useTranslations('dashboard.orders.chime');

  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      title={enabled ? t('tooltip.disable') : t('tooltip.enable')}
      aria-label={enabled ? t('tooltip.disable') : t('tooltip.enable')}
      aria-pressed={enabled}
      data-testid="chime-toggle"
      className={
        'tafel-tap flex items-center justify-center w-8 h-8 rounded-full transition-colors ' +
        (enabled ? 'bg-amber text-[#1e1508]' : 'bg-[rgba(30,21,8,0.06)] text-[#6f6353]')
      }
    >
      <Bell width={16} height={16} fill={enabled ? 'currentColor' : 'none'} />
    </button>
  );
}
