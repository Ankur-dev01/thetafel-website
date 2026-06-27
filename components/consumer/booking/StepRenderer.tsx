// components/consumer/booking/StepRenderer.tsx
//
// Switches on the current step from BookingFlowProvider. Mounts the real
// step component when available; renders a placeholder body for steps still
// under construction.

'use client';

import { useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';
import { StepR1 } from './StepR1';
import { StepR2 } from './StepR2';

interface Props {
  config: BookingConfig;
  openDaysOfWeek: number[];
}

export function StepRenderer({ config, openDaysOfWeek }: Props) {
  const { step } = useBookingFlow();
  if (step === 1) return <StepR1 config={config} openDaysOfWeek={openDaysOfWeek} />;
  if (step === 2) return <StepR2 slug={config.slug} />;
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
