'use client';

import { useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import type { ConsumerZone } from '@/lib/booking/zones';
import { useBookingFlow } from '@/lib/booking/state';
import { StepR1 } from './StepR1';
import { StepR2 } from './StepR2';
import { StepR3 } from './StepR3';
import { StepR4 } from './StepR4';
import { StepR5 } from './StepR5';
import { StepR6 } from './StepR6';

interface Props {
  config: BookingConfig;
  openDaysOfWeek: number[];
  zones: ConsumerZone[];
}

export function StepRenderer({ config, openDaysOfWeek, zones }: Props) {
  const { step } = useBookingFlow();
  if (step === 1) return <StepR1 config={config} openDaysOfWeek={openDaysOfWeek} />;
  if (step === 2) return <StepR2 slug={config.slug} />;
  if (step === 3) return <StepR3 zones={zones} />;
  if (step === 4) return <StepR4 config={config} />;
  if (step === 5) return <StepR5 config={config} />;
  if (step === 6) return <StepR6 config={config} zones={zones} />;
  return <PlaceholderBody />;
}

function PlaceholderBody() {
  const shell = useTranslations('booking.shell');
  return (
    <p
      style={{
        fontSize: 14,
        color: 'rgba(15, 13, 8, 0.4)',
        fontFamily: 'var(--font-jost), sans-serif',
        margin: 0,
      }}
    >
      {shell('placeholder_body')}
    </p>
  );
}
