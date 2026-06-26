// app/[locale]/r/[slug]/book/page.tsx
//
// Reservation entry point. Loads BookingConfig + open days server-side,
// renders one of: notFound(), inline error card, or the client step shell.

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadOpenDaysOfWeek } from '@/lib/booking/openingHours';
import { BookingFlowProvider } from '@/lib/booking/state';
import { BookingStepShell } from '@/components/consumer/booking/BookingStepShell';
import { StepRenderer } from '@/components/consumer/booking/StepRenderer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function BookingEntryPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const result = await loadBookingConfig(slug);

  if (!result.ok && result.error === 'restaurant_not_found') {
    notFound();
  }

  if (!result.ok) {
    const t = await getTranslations({ locale, namespace: 'booking.errors' });
    const messageKey =
      result.error === 'restaurant_not_live' ? 'restaurant_not_live' : 'reservations_disabled';
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '80px 20px',
          gap: 12,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(22px, 4vw, 32px)',
            color: 'var(--night, #0f0d08)',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {t(messageKey)}
        </h1>
      </div>
    );
  }

  const config = result.config;
  const [openDaysOfWeek] = await Promise.all([
    loadOpenDaysOfWeek(config.restaurantId, config.hoursPerServiceOverride),
  ]);

  const displayName = config.displayName ?? config.legalName ?? config.slug;
  const restaurantHref = `/${locale}/r/${config.slug}`;

  return (
    <BookingFlowProvider totalSteps={6}>
      <BookingStepShell restaurantName={displayName} restaurantHref={restaurantHref}>
        <StepRenderer config={config} openDaysOfWeek={openDaysOfWeek} />
      </BookingStepShell>
    </BookingFlowProvider>
  );
}
