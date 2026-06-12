import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { previousStepPath, stepPath } from '@/lib/onboarding/routes'
import { renderContract } from '@/lib/contracts/render'
import ContractClient from './ContractClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function ContractPage({ params }: PageProps) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale === 'en' ? 'en/' : ''}login`)

  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select(
      `id, current_onboarding_step,
       legal_name, kvk_number,
       legal_address_street, legal_address_house_number, legal_address_house_letter,
       legal_address_house_number_addition, legal_address_postcode, legal_address_city,
       service_reservations_enabled, service_takeaway_enabled, service_qr_enabled,
       subscription_tier`
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (restError || !restaurant) redirect(`/${locale === 'en' ? 'en/' : ''}onboarding`)

  // Guard: must be at step 13 or beyond to view this page
  if (restaurant.current_onboarding_step < 13) {
    const target = stepPath(restaurant.current_onboarding_step, locale)
    redirect(target ?? '/onboarding')
  }

  // Idempotency: if already signed, redirect forward
  const { data: existingContract } = await supabase
    .from('contracts')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('version', '1.0')
    .maybeSingle()

  if (existingContract) {
    const next = stepPath(14, locale)
    redirect(next ?? '/onboarding')
  }

  // Fetch active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, trial_ends_at, monthly_amount_cents')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['trialing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch one-time payments
  const { data: paymentsRaw } = await supabase
    .from('payments')
    .select('kind, status, amount_cents, description')
    .eq('restaurant_id', restaurant.id)
    .like('kind', 'onetime_%')

  const payments = paymentsRaw ?? []

  // Need a subscription to render the contract
  if (!subscription) redirect(`/${locale === 'en' ? 'en/' : ''}onboarding/subscription`)

  const [renderedNl, renderedEn] = await Promise.all([
    renderContract('nl', restaurant, subscription, payments),
    renderContract('en', restaurant, subscription, payments),
  ])

  const visibleSteps = getVisibleSteps(restaurant)
  const visibleStepIds = visibleSteps.map((s) => s.id)
  const currentDisplayNum = getDisplayedStepNumber(13, visibleSteps) ?? 13
  const totalSteps = getTotalWizardSteps(visibleSteps)
  const backHref = previousStepPath(13, visibleStepIds, locale) ?? stepPath(12, locale) ?? '/onboarding'
  const nextStepUrl = stepPath(14, locale) ?? '/onboarding'

  return (
    <ContractClient
      restaurantId={restaurant.id}
      restaurantLegalName={restaurant.legal_name ?? ''}
      pageLocale={locale}
      contractNl={renderedNl.markdown}
      hashNl={renderedNl.hash}
      contractEn={renderedEn.markdown}
      hashEn={renderedEn.hash}
      nextStepUrl={nextStepUrl}
      backHref={backHref}
      currentDisplayNum={currentDisplayNum}
      totalSteps={totalSteps}
    />
  )
}
