// app/[locale]/r/[slug]/book/page.tsx
//
// Reservation entry point. Loads BookingConfig + open days + zones server-side,
// then mounts the client step shell with the real step content.

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadOpenDaysOfWeek } from '@/lib/booking/openingHours';
import { loadBookableZones } from '@/lib/booking/zones';
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
  const [openDaysOfWeek, zones] = await Promise.all([
    loadOpenDaysOfWeek(config.restaurantId, config.hoursPerServiceOverride),
    loadBookableZones(config.restaurantId),
  ]);

  const displayName = config.displayName ?? config.legalName ?? config.slug;
  const restaurantHref = `/${locale}/r/${config.slug}`;

  return (
    <BookingFlowProvider config={config}>
      <BookingStepShell restaurantName={displayName} restaurantHref={restaurantHref}>
        <StepRenderer config={config} openDaysOfWeek={openDaysOfWeek} zones={zones} />
      </BookingStepShell>
    </BookingFlowProvider>
  );
}
