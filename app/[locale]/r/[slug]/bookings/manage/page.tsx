// app/[locale]/r/[slug]/bookings/manage/page.tsx
//
// Manage page - the guest lands here from the confirmation email or the
// confirmation page's "Manage this booking" link.
//
// Server component. Consumes the magic-link token, loads booking details,
// renders ManageBooking (client) or a friendly "expired" screen.

import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { headers } from 'next/headers';
import { consumeBookingMagicLink } from '@/lib/consumer/magicLinks';
import { decideCancellation } from '@/lib/booking/cancellation';
import { ManageBooking } from '@/components/consumer/booking/ManageBooking';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function ManageBookingPage({ params, searchParams }: PageProps) {
  const { locale: localeParam, slug } = await params;
  const { t: token } = await searchParams;
  const locale: 'nl' | 'en' = localeParam === 'en' ? 'en' : 'nl';

  if (!token) {
    return <ExpiredState locale={locale} slug={slug} />;
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null;
  const userAgent = hdrs.get('user-agent');

  const consumed = await consumeBookingMagicLink({
    token,
    ipAddress: ip,
    userAgent,
  });

  if (!consumed.ok) {
    return <ExpiredState locale={locale} slug={slug} />;
  }

  const b = consumed.payload;

  // Restaurant-slug sanity check - a token for a different restaurant should
  // not be usable at this URL.
  if (b.restaurantSlug !== slug) {
    return <ExpiredState locale={locale} slug={slug} />;
  }

  const decision = decideCancellation({
    bookingStatus: b.status,
    slotTimeUtc: new Date(b.slotTime),
    depositAmountCents: b.depositAmountCents,
    depositCurrency: b.depositCurrency,
  });

  // The RPC only returns restaurants.display_name, which is often null.
  // Fall back to legal_name (guaranteed non-null) rather than the site
  // brand, so the manage page never shows "The Tafel" for a restaurant
  // that simply hasn't set a display name yet.
  let restaurantName: string = b.restaurantDisplayName ?? '';
  if (!restaurantName) {
    const admin = await createSupabaseServerClientAdmin();
    const { data: restaurantRow } = await admin
      .from('restaurants')
      .select('legal_name')
      .eq('id', b.restaurantId)
      .maybeSingle();
    restaurantName = (restaurantRow?.legal_name as string | null) ?? 'Restaurant';
  }

  return (
    <main className="min-h-screen bg-cream">
      <ManageBooking
        locale={locale}
        slug={slug}
        token={token}
        booking={{
          ref: b.bookingRef,
          slotTimeIso: b.slotTime,
          partySize: b.partySize,
          status: b.status,
          restaurantName,
          depositAmountCents: b.depositAmountCents,
          depositCurrency: b.depositCurrency,
        }}
        cancellation={{
          cancellable: decision.cancellable,
          withinRefundWindow: decision.withinRefundWindow,
          refundCents: decision.refundCents,
          refundCurrency: decision.refundCurrency,
          refundDeadlineIso: decision.refundDeadlineUtc?.toISOString() ?? null,
          reason: decision.reason,
        }}
      />
    </main>
  );
}

async function ExpiredState({ locale, slug }: { locale: 'nl' | 'en'; slug: string }) {
  const t = await getTranslations({ locale, namespace: 'booking.manage' });
  const backHref = locale === 'nl' ? `/r/${slug}` : `/${locale}/r/${slug}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="flex max-w-[480px] flex-col gap-5 text-center">
        <h1 className="font-display text-[clamp(24px,4vw,32px)] font-black text-night">
          {t('expired_heading')}
        </h1>
        <p className="font-body text-[15px] leading-relaxed text-night/70">
          {t('expired_body')}
        </p>
        <Link href={backHref} className="font-body text-[15px] font-medium text-amber underline">
          {t('back_to_restaurant')}
        </Link>
      </div>
    </main>
  );
}
