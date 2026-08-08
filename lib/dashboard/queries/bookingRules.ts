import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { BookingRulesPayload } from '@/lib/dashboard/settings/bookingRulesValidation'

/**
 * Booking-rules (D5.3) query helpers. Session client for the page read —
 * RLS's owner-all policy on `restaurants` covers this; the `restaurant_id`
 * filter is belt-and-braces on top of that.
 *
 * `max_party_size_online` is read, never the sibling `max_party_size`
 * column — see bookingRulesValidation.ts's header comment for why.
 * `noshow_prepaid_window` is read ONLY to detect presence (for the
 * "advanced rules exist" UI note) — never surfaced as an editable field and
 * never written back.
 */

const BOOKING_RULES_COLUMNS = [
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
  'noshow_prepaid_window',
  'confirmation_template_nl',
  'confirmation_template_en',
  'booking_question_allergies',
  'booking_question_occasion',
  'booking_question_requests',
  'subscription_tier',
  'mollie_status',
  'mollie_access_token',
  'mollie_token_expires_at',
].join(', ')

type RawRow = {
  min_lead_time_minutes: number | null
  max_party_size_online: number
  booking_window_days: number | null
  max_guests_per_slot: number | null
  waitlist_enabled: boolean
  guest_zone_choice_enabled: boolean
  noshow_reminders_email_enabled: boolean
  noshow_reminders_whatsapp_enabled: boolean
  noshow_reconfirmation_enabled: boolean
  noshow_prepaid_enabled: boolean
  noshow_prepaid_amount_cents: number | null
  noshow_prepaid_threshold: number | null
  noshow_prepaid_window: unknown
  confirmation_template_nl: string | null
  confirmation_template_en: string | null
  booking_question_allergies: boolean
  booking_question_occasion: boolean
  booking_question_requests: boolean
  subscription_tier: 'starter' | 'plus' | 'premium' | null
  mollie_status: string
  mollie_access_token: string | null
  mollie_token_expires_at: string | null
}

export type BookingRulesInitialData = {
  rules: BookingRulesPayload
  isPremiumTier: boolean
  mollieVerified: boolean
  hasAdvancedPrepaidWindow: boolean
}

/** `tier === 'premium'` exactly — null/starter/plus are all non-premium. */
export function computeIsPremiumTier(tier: string | null): boolean {
  return tier === 'premium'
}

/**
 * Mirrors the dashboard alert's "is Mollie actually usable" check
 * (lib/dashboard/queries/alerts.ts's checkMollieBroken) rather than the
 * spec's naive `mollie_status === 'verified'` alone — a verified status
 * with a missing or expired access token is not actually usable.
 */
export function computeMollieVerified(row: {
  mollie_status: string
  mollie_access_token: string | null
  mollie_token_expires_at: string | null
}): boolean {
  if (row.mollie_status !== 'verified') return false
  if (row.mollie_access_token === null) return false
  if (row.mollie_token_expires_at !== null && new Date(row.mollie_token_expires_at).getTime() < Date.now()) {
    return false
  }
  return true
}

function toRules(row: RawRow): BookingRulesPayload {
  return {
    min_lead_time_minutes: row.min_lead_time_minutes ?? 60,
    max_party_size_online: row.max_party_size_online,
    booking_window_days: row.booking_window_days ?? 60,
    max_guests_per_slot: row.max_guests_per_slot,
    waitlist_enabled: row.waitlist_enabled,
    guest_zone_choice_enabled: row.guest_zone_choice_enabled,
    noshow_reminders_email_enabled: row.noshow_reminders_email_enabled,
    noshow_reminders_whatsapp_enabled: row.noshow_reminders_whatsapp_enabled,
    noshow_reconfirmation_enabled: row.noshow_reconfirmation_enabled,
    noshow_prepaid_enabled: row.noshow_prepaid_enabled,
    noshow_prepaid_amount_cents: row.noshow_prepaid_amount_cents,
    noshow_prepaid_threshold: row.noshow_prepaid_threshold,
    confirmation_template_nl: row.confirmation_template_nl ?? '',
    confirmation_template_en: row.confirmation_template_en ?? '',
    booking_question_allergies: row.booking_question_allergies,
    booking_question_occasion: row.booking_question_occasion,
    booking_question_requests: row.booking_question_requests,
  }
}

export async function getBookingRulesInitialData(restaurantId: string): Promise<BookingRulesInitialData> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('restaurants')
    .select(BOOKING_RULES_COLUMNS)
    .eq('id', restaurantId)
    .single<RawRow>()
  if (error) throw error

  return {
    rules: toRules(data),
    isPremiumTier: computeIsPremiumTier(data.subscription_tier),
    mollieVerified: computeMollieVerified(data),
    hasAdvancedPrepaidWindow: data.noshow_prepaid_window !== null,
  }
}
