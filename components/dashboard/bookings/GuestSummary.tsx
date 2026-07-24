'use client';

import { useTranslations } from 'next-intl';
import StatusChip from '@/components/dashboard/ui/StatusChip';
import { formatDateLong } from '@/lib/dashboard/date/amsterdamDay';
import type { GuestSummary as GuestSummaryType, GuestNote } from '@/lib/dashboard/bookings/types';

type GuestSummaryProps = {
  summary: GuestSummaryType;
  guestNote: GuestNote | null;
  locale: 'nl' | 'en';
};

export default function GuestSummary({ summary, guestNote, locale }: GuestSummaryProps) {
  const t = useTranslations('dashboard.bookings.detail');

  const subLine =
    summary.visitsCount === 0
      ? t('guestSummary.firstVisit')
      : summary.lastCompletedVisitAt
        ? t('guestSummary.lastVisit', { date: formatDateLong(summary.lastCompletedVisitAt, locale) })
        : t('guestSummary.noPrior');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-1.5"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('guestSummary.title')}
        </h3>
        <div className="flex items-baseline gap-2">
          <span
            className="text-[36px] leading-none text-[#1e1508]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
          >
            {summary.visitsCount}
          </span>
          <span
            className="text-[14px] text-[#6f6353]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {t('guestSummary.visitCount', { count: summary.visitsCount })}
          </span>
        </div>
        <p
          className="mt-1 text-[13px] text-[#6f6353]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {subLine}
        </p>
        {summary.noShowCount > 0 && (
          <div className="mt-2">
            <StatusChip
              tone="warning"
              label={t('guestSummary.noShowChip', { count: summary.noShowCount })}
            />
          </div>
        )}
      </div>

      <div>
        <h3
          className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-1.5"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('guestNote.title')}
        </h3>
        {guestNote ? (
          <div>
            <p
              className="text-[14px] text-[#1e1508] whitespace-pre-line leading-relaxed"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
            >
              {guestNote.note}
            </p>
            <p
              className="mt-1.5 text-[12px] text-[#8c8577]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
            >
              {t('guestNote.meta', {
                date: formatDateLong(guestNote.updatedAt, locale),
                name: guestNote.updatedByDisplayName ?? t('guestNote.defaultAuthor'),
              })}
            </p>
          </div>
        ) : (
          <div>
            <p
              className="text-[13px] text-[#8c8577]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
            >
              {t('guestNote.empty')}
            </p>
            <button
              type="button"
              disabled
              title={t('guestNote.addStubTooltip')}
              data-testid="detail-add-note-stub"
              className="tafel-tap mt-2 px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] cursor-not-allowed"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('guestNote.addStub')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
