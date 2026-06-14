import { NextRequest, NextResponse } from 'next/server';
import { Locale, PaymentMethod, PaymentStatus, SequenceType } from '@mollie/api-client';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertOnboardingMutationForUser } from '@/lib/onboarding/guards';
import { getMolliePlatformClient } from '@/lib/mollie/client';
import {
  applyVat,
  calculatePricing,
  buildMollieDescription,
  formatMollieAmount,
  TRIAL_DAYS,
  VAT_RATE_BPS,
  type SubscriptionTier,
  type QrPlan,
} from '@/lib/pricing/subscription';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ── Step A — Auth + restaurant load (user-scoped client) ─────────────────

    const localeParam = req.nextUrl.searchParams.get('locale') ?? 'nl';
    const locale: 'nl' | 'en' = localeParam === 'en' ? 'en' : 'nl';

    const supabase = await createSupabaseServerClient();
    const guard = await assertOnboardingMutationForUser(supabase);
    if (!guard.ok) return guard.response;
    const { restaurant, user } = guard;

    if (!restaurant.subscription_tier) {
      return NextResponse.json({ error: 'tier_not_selected' }, { status: 400 });
    }

    if ((restaurant.current_onboarding_step as number) < 12) {
      return NextResponse.json({ error: 'step_out_of_order' }, { status: 400 });
    }

    const tier = restaurant.subscription_tier as SubscriptionTier;
    const qrPlan = restaurant.qr_plan as QrPlan | null;

    // ── Step B — Compute amounts ──────────────────────────────────────────────

    const admin = await createSupabaseServerClientAdmin();

    const { count: qrTableCountRaw } = await admin
      .from('restaurant_tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .is('deleted_at', null)
      .eq('is_qr_enabled', true);
    const qrTableCount = qrTableCountRaw ?? 0;

    const pricing = calculatePricing({ tier, qrPlan, qrTableCount });
    const subscriptionGross = applyVat(pricing.monthlyCents).grossCents;
    const oneTimeNet = pricing.totalDueTodayCents;
    const oneTimeGross = applyVat(oneTimeNet).grossCents;

    // ── Step C — Starter branch (no Mollie) ───────────────────────────────────

    if (tier === 'starter') {
      const { data: existingSub } = await admin
        .from('subscriptions')
        .select('id')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();

      if (!existingSub) {
        await admin.from('subscriptions').insert({
          restaurant_id: restaurant.id,
          tier: 'starter',
          status: 'active',
          monthly_amount_cents: 0,
          vat_rate_bps: VAT_RATE_BPS,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date().toISOString(),
        });
      }

      await admin
        .from('restaurants')
        .update({ current_onboarding_step: 13 })
        .eq('id', restaurant.id);

      try {
        await admin.from('audit_logs').insert({
          restaurant_id: restaurant.id,
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          event_type: 'subscription.starter_activated',
          event_data: { tier: 'starter' },
        });
      } catch (auditErr) {
        console.error('[checkout] audit log failed (starter):', auditErr);
      }

      return NextResponse.json({
        skipped: true,
        nextStepUrl: `/${locale}/onboarding/contract`,
      });
    }

    // ── Step D — Plus/Premium branch (Mollie) ─────────────────────────────────

    const mollie = getMolliePlatformClient();

    // Idempotency: reuse an existing open Mollie session if possible
    const { data: existingPendingPayment } = await admin
      .from('payments')
      .select('id, mollie_payment_id, amount_cents, created_at')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPendingPayment?.mollie_payment_id) {
      const createdAt = new Date(existingPendingPayment.created_at as string).getTime();
      if (Date.now() - createdAt < 25 * 60 * 1000) {
        try {
          const existingMolliePayment = await mollie.payments.get(
            existingPendingPayment.mollie_payment_id as string
          );
          if (existingMolliePayment.status === PaymentStatus.open) {
            return NextResponse.json({ checkoutUrl: existingMolliePayment.getCheckoutUrl() });
          }
          // Expired/failed/canceled — mark the DB row and fall through to create a new payment
          await admin
            .from('payments')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              failure_reason: `mollie_status_${existingMolliePayment.status}`,
            })
            .eq('id', existingPendingPayment.id);
        } catch (e) {
          console.error('[checkout] failed to look up existing mollie payment', e);
        }
      }
    }

    // Get or create Mollie customer
    let mollieCustomerId: string;

    const { data: subRow } = await admin
      .from('subscriptions')
      .select('id, mollie_customer_id')
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();

    if (subRow?.mollie_customer_id) {
      mollieCustomerId = subRow.mollie_customer_id as string;
    } else {
      const customer = await mollie.customers.create({
        name: (restaurant.name as string | null) ?? '',
        email: (restaurant.contact_email as string | null) ?? '',
        locale: locale === 'nl' ? Locale.nl_NL : Locale.en_US,
        metadata: { restaurant_id: restaurant.id } as Record<string, unknown>,
      });
      mollieCustomerId = customer.id;
    }

    // Determine first-payment amount and kind
    const isVerification = oneTimeGross === 0;
    const firstPaymentGross = isVerification ? 1 : oneTimeGross;
    const paymentKind = isVerification ? 'subscription_charge' : 'onetime_qr_setup';

    // Pre-generate payment row UUID so it can go into Mollie metadata before the row exists
    const ourPaymentId = crypto.randomUUID();

    // Build redirect + webhook URLs
    // Webhook target: must be publicly reachable for Mollie to deliver events.
    // In dev this points at the production webhook handler — the prod handler
    // treats unknown mollie_payment_id values as no-ops, so it's safe.
    const publicBaseUrl = process.env.QR_BASE_URL || 'http://localhost:3000';
    // Redirect target: where the customer's browser lands after Mollie.
    // In dev, override to localhost so the flow returns to the running dev server.
    const redirectBaseUrl =
      process.env.NODE_ENV === 'production' ? publicBaseUrl : 'http://localhost:3000';
    const redirectUrl = `${redirectBaseUrl}/${locale}/onboarding/subscription/return?id=${ourPaymentId}`;
    const webhookUrl = `${publicBaseUrl}/api/mollie/webhook`;

    const description = buildMollieDescription({ locale, tier, qrPlan, isVerification });

    // Create Mollie first payment (sequenceType=first bootstraps the SEPA mandate)
    // Dev-mode override: Mollie test SEPA Direct Debit takes 1–2 days to activate
    // and stays in 'pending' forever in test mode anyway. Mollie's documented test
    // path for recurring is credit card. In production we omit `method` so the
    // hosted page shows iDEAL + Cards (iDEAL primary for nl_NL) once SEPA DD is active.
    const devMethodOverride =
      process.env.NODE_ENV !== 'production' ? { method: PaymentMethod.creditcard } : {};

    const molliePayment = await mollie.payments.create({
      customerId: mollieCustomerId,
      sequenceType: SequenceType.first,
      ...devMethodOverride,
      amount: {
        value: formatMollieAmount(firstPaymentGross),
        currency: 'EUR',
      },
      description,
      redirectUrl,
      webhookUrl,
      metadata: {
        restaurant_id: restaurant.id,
        our_payment_id: ourPaymentId,
        is_verification: isVerification,
        tier: restaurant.subscription_tier,
        qr_plan: restaurant.qr_plan,
        net_cents: isVerification ? 0 : oneTimeNet,
        gross_cents: firstPaymentGross,
      } as Record<string, unknown>,
    });

    // Persist subscription row (update if exists, insert if not)
    let subscriptionId: string;
    if (subRow) {
      await admin
        .from('subscriptions')
        .update({
          tier,
          status: 'trialing',
          monthly_amount_cents: subscriptionGross,
          vat_rate_bps: VAT_RATE_BPS,
          mollie_customer_id: mollieCustomerId,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000).toISOString(),
        })
        .eq('id', subRow.id);
      subscriptionId = subRow.id as string;
    } else {
      const { data: newSub } = await admin
        .from('subscriptions')
        .insert({
          restaurant_id: restaurant.id,
          tier,
          status: 'trialing',
          monthly_amount_cents: subscriptionGross,
          vat_rate_bps: VAT_RATE_BPS,
          mollie_customer_id: mollieCustomerId,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000).toISOString(),
        })
        .select('id')
        .single();
      subscriptionId = newSub!.id as string;
    }

    // Persist payment row
    await admin.from('payments').insert({
      id: ourPaymentId,
      restaurant_id: restaurant.id,
      subscription_id: subscriptionId,
      kind: paymentKind,
      status: 'pending',
      amount_cents: firstPaymentGross,
      currency: 'EUR',
      vat_rate_bps: VAT_RATE_BPS,
      description,
      mollie_payment_id: molliePayment.id,
    });

    // Audit log (best-effort — never blocks the user-facing flow)
    try {
      await admin.from('audit_logs').insert({
        restaurant_id: restaurant.id,
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        event_type: 'subscription.checkout_initiated',
        event_data: {
          tier: restaurant.subscription_tier,
          qr_plan: restaurant.qr_plan,
          net_cents: oneTimeNet,
          gross_cents: firstPaymentGross,
          is_verification: isVerification,
          mollie_payment_id: molliePayment.id,
          mollie_customer_id: mollieCustomerId,
        },
      });
    } catch (auditErr) {
      console.error('[checkout] audit log failed (plus/premium):', auditErr);
    }

    return NextResponse.json({ checkoutUrl: molliePayment.getCheckoutUrl() });
  } catch (err) {
    console.error('[/api/v1/restaurants/subscription/checkout] error:', err);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
