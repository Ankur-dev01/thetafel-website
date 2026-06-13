import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import ReviewClient, { type ChecklistRow } from './ReviewClient'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: 'nl' | 'en' }>
}

export default async function ReviewPage({ params }: PageProps) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(locale === 'en' ? '/en/login' : '/login')
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      `id, status, current_onboarding_step,
       legal_name, trade_name, display_name, slug, kvk_number,
       service_reservations_enabled, service_takeaway_enabled,
       service_qr_enabled, qr_plan,
       subscription_tier, mollie_status,
       legal_address_city, legal_address_street, legal_address_house_number,
       submitted_at`
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!restaurant) {
    redirect(locale === 'en' ? '/en/onboarding' : '/onboarding')
  }

  // If already live, D8.B will handle the redirect to /onboarding/live.
  if (restaurant.status === 'live') {
    redirect(locale === 'en' ? '/en/onboarding' : '/onboarding')
  }

  const [subRes, contractRes, floorRes, hoursRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, status, trial_ends_at, monthly_amount_cents')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['trialing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('contracts')
      .select('signed_name, signed_at, locale_signed, version')
      .eq('restaurant_id', restaurant.id)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('floor_plan_tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id),
    supabase
      .from('opening_hours')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id),
  ])

  const subscription = subRes.data
  const contract = contractRes.data
  const tableCount = floorRes.count ?? 0
  const hoursCount = hoursRes.count ?? 0

  const T =
    locale === 'en'
      ? {
          kvkLabel: 'KVK',
          tablesLabel: (n: number) => `${n} table${n === 1 ? '' : 's'} configured`,
          hoursLabel: (n: number) => `${n} day${n === 1 ? '' : 's'} of opening hours set`,
          tierLabel: (tier: string) => `${cap(tier)} tier`,
          contractLabel: (name: string, date: string) => `Signed by ${name} on ${date}`,
          reservationsLabel: 'Online reservations enabled',
          takeawayLabel: 'Takeaway enabled',
          qrLabel: (plan: string | null) =>
            plan === 'premium'
              ? 'QR ordering enabled — Premium card pack'
              : plan === 'basic'
                ? 'QR ordering enabled — Basic sticker pack'
                : 'QR ordering enabled',
          mollieLabel: (status: string | null) =>
            status === 'verified'
              ? 'Mollie verified'
              : status === 'pending'
                ? 'Mollie verification in progress'
                : 'Mollie connection initiated',
          addressLabel: (city: string | null) =>
            city ? `Registered at ${city}` : 'Restaurant details captured',
        }
      : {
          kvkLabel: 'KVK',
          tablesLabel: (n: number) => `${n} tafel${n === 1 ? '' : 's'} ingericht`,
          hoursLabel: (n: number) =>
            `${n} dag${n === 1 ? '' : 'en'} openingstijden ingesteld`,
          tierLabel: (tier: string) => `${cap(tier)}-pakket`,
          contractLabel: (name: string, date: string) => `Getekend door ${name} op ${date}`,
          reservationsLabel: 'Online reserveringen ingeschakeld',
          takeawayLabel: 'Afhalen ingeschakeld',
          qrLabel: (plan: string | null) =>
            plan === 'premium'
              ? 'QR-bestellen ingeschakeld — Premium kaartenpakket'
              : plan === 'basic'
                ? 'QR-bestellen ingeschakeld — Basic stickerpakket'
                : 'QR-bestellen ingeschakeld',
          mollieLabel: (status: string | null) =>
            status === 'verified'
              ? 'Mollie geverifieerd'
              : status === 'pending'
                ? 'Mollie-verificatie loopt'
                : 'Mollie-verbinding gestart',
          addressLabel: (city: string | null) =>
            city ? `Geregistreerd in ${city}` : 'Restaurantgegevens vastgelegd',
        }

  const rows: ChecklistRow[] = []

  rows.push({
    key: 'details',
    label: locale === 'en' ? 'Restaurant details' : 'Restaurantgegevens',
    summary: T.addressLabel(restaurant.legal_address_city ?? null),
  })

  if (restaurant.kvk_number) {
    rows.push({
      key: 'kvk',
      label: locale === 'en' ? 'KVK registration' : 'KVK-registratie',
      summary: `${T.kvkLabel} ${restaurant.kvk_number}`,
    })
  }

  if (tableCount > 0) {
    rows.push({
      key: 'floor',
      label: locale === 'en' ? 'Floor plan' : 'Plattegrond',
      summary: T.tablesLabel(tableCount),
    })
  }

  if (hoursCount > 0) {
    rows.push({
      key: 'hours',
      label: locale === 'en' ? 'Opening hours' : 'Openingstijden',
      summary: T.hoursLabel(hoursCount),
    })
  }

  if (restaurant.service_reservations_enabled) {
    rows.push({
      key: 'reservations',
      label: locale === 'en' ? 'Reservations' : 'Reserveringen',
      summary: T.reservationsLabel,
    })
  }

  if (restaurant.service_takeaway_enabled) {
    rows.push({
      key: 'takeaway',
      label: locale === 'en' ? 'Takeaway' : 'Afhalen',
      summary: T.takeawayLabel,
    })
  }

  if (restaurant.service_qr_enabled) {
    rows.push({
      key: 'qr',
      label: locale === 'en' ? 'QR ordering' : 'QR-bestellen',
      summary: T.qrLabel(restaurant.qr_plan ?? null),
    })
  }

  rows.push({
    key: 'mollie',
    label: 'Mollie',
    summary: T.mollieLabel(restaurant.mollie_status ?? null),
  })

  if (subscription?.tier) {
    rows.push({
      key: 'subscription',
      label: locale === 'en' ? 'Subscription' : 'Abonnement',
      summary: T.tierLabel(subscription.tier),
    })
  }

  if (contract?.signed_at && contract?.signed_name) {
    rows.push({
      key: 'contract',
      label: 'Contract',
      summary: T.contractLabel(
        contract.signed_name,
        formatDate(contract.signed_at, locale)
      ),
    })
  }

  const initialSubmitted = restaurant.status === 'pending_review'

  return (
    <ReviewClient
      locale={locale}
      restaurantId={restaurant.id}
      restaurantDisplayName={
        restaurant.display_name ?? restaurant.trade_name ?? restaurant.legal_name ?? ''
      }
      rows={rows}
      initialSubmitted={initialSubmitted}
      submittedAtIso={restaurant.submitted_at}
    />
  )
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)
}

function formatDate(iso: string, locale: 'nl' | 'en'): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-GB' : 'nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}
