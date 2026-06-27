// components/consumer/booking/StepRenderer.tsx
//
// Switches on the current step from BookingFlowProvider. Mounts the real
// step component when available; renders a placeholder for steps still
// under construction.

'use client';

import { useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import type { ConsumerZone } from '@/lib/booking/zones';
import { useBookingFlow } from '@/lib/booking/state';
import { StepR1 } from './StepR1';
import { StepR2 } from './StepR2';
import { StepR3 } from './StepR3';
import { StepR4 } from './StepR4';

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
