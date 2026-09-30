// lib/consumer/notifications/bookingReminders.ts
//
// D5.6d: guest booking reminder emails (24h + 2h before the reservation).
// Called from app/api/cron/booking-reminders/route.ts, itself triggered by
// a pg_cron job every 10 minutes (scheduled outside this repo — see
// migration 028_cron_infrastructure.sql).
//
// Manage-link mechanics (Step 0.1 finding): `magic_links` has no unique
// constraint on booking_id and `lookup_booking_by_magic_link` matches
// purely on token_hash — multiple `manage_booking` rows can coexist for the
// same booking without invalidating each other. A fresh token issued here
// via createMagicLink() never breaks the one already sent in the
// confirmation email. No STOP condition.
//
// Guest locale (Step 0.8 finding, fixed in D5.6d-fix): the `magic_links`
// row inserted at booking-creation time (lib/booking/createBooking.ts) used
// to omit `locale` entirely, so it was NULL for every booking made before
// this fix — those older bookings fall back to 'nl' here, permanently
// (there's nothing to backfill from). Bookings made after the fix land with
// a real locale on their original manage_booking row, read below via
// resolveGuestLocale (oldest manage_booking row for the booking, so a
// later-issued reminder token never shadows the guest's actual choice).

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { createMagicLink } from '../magicLinks'
import { buildManageBookingUrl } from './format'
import { sendConsumerEmail } from '../email/send'
import { renderBookingReminder } from '../email/templates/bookingReminder'
import { formatRestaurantAddressLine } from '@/lib/booking/confirmationTemplate'

const SCAN_WINDOW_HOURS = 24
const SCAN_LIMIT = 200

const HOUR_MS = 60 * 60 * 1000

export type ReminderKind = '24h' | '2h'

export type RunBookingRemindersResult = {
  scanned: number
  sent24h: number
  sent2h: number
  skipped: number
  failed: number
}

/**
 * Pure decision function — no I/O, easy to unit-test.
 *
 * A booking never gets both reminders in the same run. If the 24h window
 * was missed entirely (e.g. booked with only 20h lead time), only the 2h
 * reminder ever fires — that's intended, not a bug.
 */
export function decideReminder(args: {
  now: Date
  slotTime: Date
  createdAt: Date
  sent24hAt: Date | null
  sent2hAt: Date | null
}): ReminderKind | null {
  const { now, slotTime, createdAt, sent24hAt, sent2hAt } = args

  const hoursUntil = (slotTime.getTime() - now.getTime()) / HOUR_MS
  const leadTime = (slotTime.getTime() - createdAt.getTime()) / HOUR_MS

  if (hoursUntil <= 2 && sent2hAt === null && leadTime >= 3) {
    return '2h'
  }
  if (hoursUntil <= 24 && hoursUntil > 3 && sent24hAt === null && leadTime >= 24) {
    return '24h'
  }
  return null
}

type RestaurantRow = {
  status: string
  deleted_at: string | null
  noshow_reminders_email_enabled: boolean
  display_name: string | null
  legal_name: string | null
  slug: string
  contact_phone: string | null
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
}

type GuestRow = {
  email: string | null
  full_name: string | null
  anonymised_at: string | null
}

type CandidateRow = {
  id: string
  restaurant_id: string
  booking_ref: string
  slot_time: string
  party_size: number
  created_at: string
  reminder_24h_sent_at: string | null
  reminder_2h_sent_at: string | null
  restaurant: RestaurantRow | RestaurantRow[] | null
  guest: GuestRow | GuestRow[] | null
}

function firstOf<T>(v: T | T[] | null): T | null {
  if (v === null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type SupabaseAdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>

/**
 * The booking's original manage_booking magic_links row, oldest first, is
 * the earliest real record of which language the guest booked in. Falls
 * back to 'nl' when there's no row or no locale on it (older bookings, or
 * the rare insert-failed case createBooking.ts already tolerates).
 */
async function resolveGuestLocale(admin: SupabaseAdminClient, bookingId: string): Promise<'nl' | 'en'> {
  const { data, error } = await admin
    .from('magic_links')
    .select('locale')
    .eq('booking_id', bookingId)
    .eq('purpose', 'manage_booking')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ locale: string | null }>()

  if (error || !data) return 'nl'
  return data.locale === 'en' ? 'en' : 'nl'
}

export async function runBookingReminders(now: Date = new Date()): Promise<RunBookingRemindersResult> {
  const result: RunBookingRemindersResult = { scanned: 0, sent24h: 0, sent2h: 0, skipped: 0, failed: 0 }

  const admin = await createSupabaseServerClientAdmin()

  const nowIso = now.toISOString()
  const windowEndIso = new Date(now.getTime() + SCAN_WINDOW_HOURS * HOUR_MS).toISOString()

  const { data, error } = await admin
    .from('bookings')
    .select(
      `id, restaurant_id, booking_ref, slot_time, party_size, created_at,
       reminder_24h_sent_at, reminder_2h_sent_at,
       restaurant:restaurants(status, deleted_at, noshow_reminders_email_enabled, display_name, legal_name, slug, contact_phone, legal_address_street, legal_address_house_number, legal_address_house_letter, legal_address_house_number_addition, legal_address_postcode, legal_address_city),
       guest:guests(email, full_name, anonymised_at)`,
    )
    .eq('status', 'confirmed')
    .gt('slot_time', nowIso)
    .lte('slot_time', windowEndIso)
    .or('reminder_24h_sent_at.is.null,reminder_2h_sent_at.is.null')
    .order('slot_time', { ascending: true })
    .limit(SCAN_LIMIT)
    .returns<CandidateRow[]>()

  if (error) {
    console.error('[bookingReminders] candidate query failed', error.message)
    return result
  }

  const candidates = data ?? []
  result.scanned = candidates.length

  for (const row of candidates) {
    try {
      const restaurant = firstOf(row.restaurant)
      const guest = firstOf(row.guest)

      if (!restaurant || restaurant.status !== 'live' || restaurant.deleted_at !== null) {
        result.skipped++
        continue
      }
      if (!restaurant.noshow_reminders_email_enabled) {
        result.skipped++
        continue
      }
      if (!guest || !guest.email || guest.anonymised_at !== null) {
        result.skipped++
        continue
      }

      const kind = decideReminder({
        now,
        slotTime: new Date(row.slot_time),
        createdAt: new Date(row.created_at),
        sent24hAt: row.reminder_24h_sent_at ? new Date(row.reminder_24h_sent_at) : null,
        sent2hAt: row.reminder_2h_sent_at ? new Date(row.reminder_2h_sent_at) : null,
      })

      if (!kind) {
        result.skipped++
        continue
      }

      // Claim before send — an atomic conditional UPDATE means two
      // overlapping cron runs can never both send the same reminder.
      const claimColumn = kind === '24h' ? 'reminder_24h_sent_at' : 'reminder_2h_sent_at'
      const { data: claimed, error: claimErr } = await admin
        .from('bookings')
        .update({ [claimColumn]: nowIso })
        .eq('id', row.id)
        .is(claimColumn, null)
        .select('id')

      if (claimErr) {
        console.error('[bookingReminders] claim failed', { bookingId: row.id, error: claimErr.message })
        result.failed++
        continue
      }
      if (!claimed || claimed.length === 0) {
        // Another run claimed it first.
        result.skipped++
        continue
      }

      const restaurantName = restaurant.display_name ?? restaurant.legal_name ?? restaurant.slug
      const addressLine = formatRestaurantAddressLine(restaurant)
      const guestLocale = await resolveGuestLocale(admin, row.id)

      const link = await createMagicLink({
        purpose: 'manage_booking',
        bookingId: row.id,
        restaurantId: row.restaurant_id,
        locale: guestLocale,
      })

      if (!link.ok) {
        console.error('[bookingReminders] createMagicLink failed', { bookingId: row.id, reason: link.reason })
        result.failed++
        continue
      }

      const manageUrl = buildManageBookingUrl({
        slug: restaurant.slug,
        magicLinkToken: link.token,
        locale: guestLocale,
      })

      const rendered = renderBookingReminder({
        locale: guestLocale,
        kind,
        guestFullName: guest.full_name ?? '',
        restaurantName,
        slotTime: row.slot_time,
        partySize: row.party_size,
        bookingRef: row.booking_ref,
        restaurantAddressLine: addressLine,
        restaurantPhone: restaurant.contact_phone,
        manageUrl,
      })

      const send = await sendConsumerEmail({
        to: guest.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        templateKey: kind === '24h' ? 'booking.reminder_24h' : 'booking.reminder_2h',
        restaurantId: row.restaurant_id,
        bookingId: row.id,
        skipAdminBcc: true,
      })

      if (send.ok) {
        if (kind === '24h') result.sent24h++
        else result.sent2h++
      } else {
        // Claim stays in place (at-most-once) — sendConsumerEmail already
        // retried internally and wrote its own email.send_failed audit row.
        result.failed++
      }
    } catch (err) {
      console.error('[bookingReminders] unexpected error processing booking', { bookingId: row.id, err })
      result.failed++
    }
  }

  return result
}
