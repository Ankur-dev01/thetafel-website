// components/consumer/booking/StepRenderer.tsx
//
// Switches on the current step. Step 1 mounts the real form;
// steps 2-6 render a placeholder body until their own units land.

'use client';

import { useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';
import { StepR1 } from './StepR1';

interface Props {
  config: BookingConfig;
  openDaysOfWeek: number[];
}

export function StepRenderer({ config, openDaysOfWeek }: Props) {
  const { step } = useBookingFlow();
  if (step === 1) return <StepR1 config={config} openDaysOfWeek={openDaysOfWeek} />;
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
