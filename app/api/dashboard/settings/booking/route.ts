// app/api/dashboard/settings/booking/route.ts
//
// POST /api/dashboard/settings/booking
// Body: BookingRulesPayload (see lib/dashboard/settings/bookingRulesValidation.ts)
//
// First dashboard write path to these `restaurants` columns — every other
// write to them lives under onboarding's `/api/v1/restaurants/draft` route,
// gated to `status === 'onboarding'` only. This route is independent of
// that gate, same posture as D5.1/D5.2's settings routes.
//
// Response shape is `{ ok: false, code, message }` (single code), not a
// field-level errors array — the spec calls for distinct top-level codes
// (whatsapp_needs_premium, prepaid_needs_mollie, prepaid_threshold_required,
// template_missing_restaurant, template_unknown_placeholder) the client
// maps directly to specific copy.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseBookingRulesPayload,
  validateBookingRulesPayload,
  type BookingRulesPayload,
} from '@/lib/dashboard/settings/bookingRulesValidation';
import { computeIsPremiumTier, computeMollieVerified } from '@/lib/dashboard/queries/bookingRules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = [
  'min_lead_time_minutes',
  'max_party_size_online',
  'booking_window_days',
  'max_guests_per_slot',
  'waitlist_enabled',
  'guest_zone_choice_enabled',
  'noshow_reminders_email_enabled',
  'noshow_reminders_whatsapp_enabled',
  'noshow_reconfirmation_enabled',
  'noshow_prepaid_enabled',
  'noshow_prepaid_amount_cents',
  'noshow_prepaid_threshold',
  'confirmation_template_nl',
  'confirmation_template_en',
  'booking_question_allergies',
  'booking_question_occasion',
  'booking_question_requests',
] as const satisfies readonly (keyof BookingRulesPayload)[];

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.booking.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseBookingRulesPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown> & {
    subscription_tier: string | null;
    mollie_status: string;
    mollie_access_token: string | null;
    mollie_token_expires_at: string | null;
  };

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select(
      'min_lead_time_minutes, max_party_size_online, booking_window_days, max_guests_per_slot, waitlist_enabled, guest_zone_choice_enabled, noshow_reminders_email_enabled, noshow_reminders_whatsapp_enabled, noshow_reconfirmation_enabled, noshow_prepaid_enabled, noshow_prepaid_amount_cents, noshow_prepaid_threshold, confirmation_template_nl, confirmation_template_en, booking_question_allergies, booking_question_occasion, booking_question_requests, subscription_tier, mollie_status, mollie_access_token, mollie_token_expires_at',
    )
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[settings/booking] current row load failed', loadError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  // Never trust the client's copy of tier/Mollie state — re-check against
  // what was just freshly reloaded.
  const context = {
    isPremiumTier: computeIsPremiumTier(current.subscription_tier),
    mollieVerified: computeMollieVerified({
      mollie_status: current.mollie_status,
      mollie_access_token: current.mollie_access_token,
      mollie_token_expires_at: current.mollie_token_expires_at,
    }),
  };

  const validationError = validateBookingRulesPayload(payload, context);
  if (validationError) {
    return NextResponse.json({ ok: false, ...validationError }, { status: 400, headers: NO_STORE });
  }

  const update: Record<string, unknown> = {};
  const fieldsChanged: string[] = [];
  for (const column of WRITE_COLUMNS) {
    update[column] = payload[column];
    if ((current as Record<string, unknown>)[column] !== payload[column]) {
      fieldsChanged.push(column);
    }
  }

  const { error: updateError } = await admin.from('restaurants').update(update).eq('id', restaurant.id);
  if (updateError) {
    console.error('[settings/booking] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.booking.edit',
    eventData: { fields_changed: fieldsChanged },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
