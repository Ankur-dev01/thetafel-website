// components/consumer/booking/StepR1.tsx
//
// First booking step: pick a date and a party size. Both selections write
// directly to the booking draft so a Back from R2 restores them.

'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import { latestBookableDate } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';
import { DatePicker } from './DatePicker';
import { PartySizeSelector } from './PartySizeSelector';

interface Props {
  config: BookingConfig;
  openDaysOfWeek: number[];
}

export function StepR1({ config, openDaysOfWeek }: Props) {
  const t = useTranslations('booking.r1');
  const locale = useLocale();
  const { draft, updateDraft, setCanContinue } = useBookingFlow();

  const minDate = todayInAmsterdam();
  const maxDate = latestBookableDate(config);

  useEffect(() => {
    const valid =
      draft.date != null &&
      draft.partySize != null &&
      draft.partySize >= 1 &&
      draft.partySize <= config.maxPartySizeOnline;
    setCanContinue(valid);
  }, [draft.date, draft.partySize, config.maxPartySizeOnline, setCanContinue]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Date section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(18px, 3vw, 22px)',
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {t('date_label')}
        </h2>
        <DatePicker
          selectedDate={draft.date}
          onSelect={(date) => updateDraft({ date })}
          minDate={minDate}
          maxDate={maxDate}
          openDaysOfWeek={openDaysOfWeek}
          locale={locale}
        />
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'rgba(156, 139, 106, 0.15)' }} />

      {/* Party size section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(18px, 3vw, 22px)',
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {t('party_label')}
        </h2>
        <PartySizeSelector
          selectedPartySize={draft.partySize}
          max={config.maxPartySizeOnline}
          onSelect={(partySize) => updateDraft({ partySize })}
        />
      </div>
    </div>
  );
}

function todayInAmsterdam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
