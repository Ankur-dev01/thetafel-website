'use client';

import { useTranslations } from 'next-intl';
import { amsterdamCivilDate, formatDateHeading } from '@/lib/dashboard/date/amsterdamDay';
import { formatWallClockAmsterdam } from '@/lib/dashboard/format/time';
import type { HistoryEntry } from '@/lib/dashboard/bookings/types';

// Event types the messages file has a translation for. Anything else falls
// back to a humanized version of the raw event_type + a console.warn, so a
// new event added later surfaces here instead of silently vanishing.
const KNOWN_EVENT_TYPES = new Set([
  'booking.marked_attended',
  'booking.marked_no_show',
  'booking.cancelled_by_staff',
  'booking.edited',
  'booking.deposit_refunded',
  'booking.create.succeeded',
  'booking.create.replay',
  'booking.cancelled_by_guest',
  'booking.change_requested',
  'booking.ics_downloaded',
  'email.sent',
  'email.send_failed',
  'whatsapp.sent',
  'whatsapp.send_failed',
]);

function humanizeEventType(eventType: string): string {
  return eventType
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type BookingHistoryProps = {
  history: HistoryEntry[];
  locale: 'nl' | 'en';
};

export default function BookingHistory({ history, locale }: BookingHistoryProps) {
  const t = useTranslations('dashboard.bookings.detail');
  const tEvent = useTranslations('dashboard.bookings.detail.event');

  if (history.length === 0) {
    return (
      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-1.5"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('history.title')}
        </h3>
        <p
          className="text-[13px] text-[#8c8577]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('history.empty')}
        </p>
      </div>
    );
  }

  const today = amsterdamCivilDate(new Date());
  const yesterday = amsterdamCivilDate(new Date(Date.now() - 24 * 3600_000));

  const groups: { dayLabel: string; entries: HistoryEntry[] }[] = [];
  for (const entry of history) {
    const civilDate = amsterdamCivilDate(new Date(entry.at));
    const dayLabel =
      civilDate === today
        ? t('history.day.today')
        : civilDate === yesterday
          ? t('history.day.yesterday')
          : formatDateHeading(civilDate, locale);

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayLabel === dayLabel) {
      lastGroup.entries.push(entry);
    } else {
      groups.push({ dayLabel, entries: [entry] });
    }
  }

  return (
    <div>
      <h3
        className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-1.5"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('history.title')}
      </h3>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.dayLabel}>
            <div
              className="text-[11px] uppercase tracking-[0.08em] text-[#a89a7d] mb-1"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {group.dayLabel}
            </div>
            <div className="flex flex-col gap-1.5">
              {group.entries.map((entry) => {
                let label: string;
                if (KNOWN_EVENT_TYPES.has(entry.eventType)) {
                  // eventType strings ('booking.create.succeeded', 'email.sent', …)
                  // are themselves next-intl dot-paths into the nested
                  // dashboard.bookings.detail.event.* namespace — no lookup
                  // table needed, the JSON structure mirrors the event names.
                  label = tEvent(entry.eventType);
                } else {
                  console.warn('[BookingHistory] unknown event_type', entry.eventType);
                  label = humanizeEventType(entry.eventType);
                }
                return (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div
                      className="text-[13px] text-[#8c8577] w-11 flex-shrink-0 pt-0.5"
                      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
                    >
                      {formatWallClockAmsterdam(entry.at)}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-[13px] text-[#1e1508]"
                        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
                      >
                        {label}
                      </div>
                      {entry.source === 'dashboard' && entry.actorDisplayName && (
                        <div
                          className="text-[12px] text-[#8c8577]"
                          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
                        >
                          {entry.actorDisplayName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
