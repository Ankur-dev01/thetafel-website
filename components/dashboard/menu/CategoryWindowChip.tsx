import StatusChip from '@/components/dashboard/ui/StatusChip';
import { ClockArrival } from '@/components/dashboard/icons';

// menu_categories.window_start/window_end are Postgres `time` columns —
// plain wall-clock values like "12:00:00" with no date or timezone
// component, unlike the timestamptz fields elsewhere in the dashboard. No
// Date parsing needed, just trim to HH:MM.
function formatWallClock(time: string): string {
  return time.slice(0, 5);
}

type CategoryWindowChipProps = {
  windowStart: string | null;
  windowEnd: string | null;
};

/** "12:00 – 15:00" pill — only renders when both bounds are set. A lone bound is a data anomaly, logged rather than half-rendered. */
export default function CategoryWindowChip({ windowStart, windowEnd }: CategoryWindowChipProps) {
  if (!windowStart && !windowEnd) return null;
  if (!windowStart || !windowEnd) {
    console.warn('[CategoryWindowChip] only one of window_start/window_end is set', { windowStart, windowEnd });
    return null;
  }
  return (
    <StatusChip
      tone="neutral"
      icon={<ClockArrival width={13} height={13} />}
      label={`${formatWallClock(windowStart)} – ${formatWallClock(windowEnd)}`}
    />
  );
}
