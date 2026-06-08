import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getVisibleSteps, getTotalWizardSteps, getDisplayedStepNumber } from '@/lib/onboarding/steps';
import { previousStepPath, stepPath } from '@/lib/onboarding/routes';
import { calculatePricing } from '@/lib/pricing/subscription';
import type { SubscriptionTier, QrPlan } from '@/lib/pricing/subscription';
import SubscriptionPicker from './SubscriptionPicker';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: 'nl' | 'en' }>;
}

export default async function SubscriptionPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, current_onboarding_step, subscription_tier, qr_plan, service_reservations_enabled, service_takeaway_enabled, service_qr_enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !restaurant) redirect(`/${locale}/onboarding`);

  const { count: qrTableCountRaw } = await supabase
    .from('restaurant_tables')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)
    .eq('is_qr_enabled', true);
  const qrTableCount = qrTableCountRaw ?? 0;

  const tier = restaurant.subscription_tier as SubscriptionTier | null;
  const qrPlan = restaurant.qr_plan as QrPlan | null;

  const initialPricing = calculatePricing({ tier, qrPlan, qrTableCount });

  const visibleSteps = getVisibleSteps(restaurant);
  const visibleStepIds = visibleSteps.map((s) => s.id);
  const currentDisplayNum = getDisplayedStepNumber(12, visibleSteps) ?? 12;
  const totalSteps = getTotalWizardSteps(visibleSteps);
  const backHref = previousStepPath(12, visibleStepIds, locale) ?? stepPath(11, locale);

  return (
    <SubscriptionPicker
      locale={locale}
      restaurantId={restaurant.id}
      initialTier={tier}
      initialQrPlan={qrPlan}
      qrOrderingEnabled={restaurant.service_qr_enabled ?? false}
      qrTableCount={qrTableCount}
      initialPricing={initialPricing}
      currentDisplayNum={currentDisplayNum}
      totalSteps={totalSteps}
      backHref={backHref}
      visibleStepIds={visibleStepIds}
    />
  );
}
