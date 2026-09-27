// lib/dashboard/settings/businessValidation.ts
//
// Shared business-details-payload validation, imported by BOTH the client
// form and the mutating route, same posture as bookingRulesValidation /
// qrSettingsValidation. The client copy is UX only — the server always
// re-validates the parsed payload before writing.
//
// btw_number has no "empty is fine" exception, unlike phone/email/website —
// every save through this route requires a valid BTW number, which is the
// backfill mechanism for the pre-BTW-1 restaurants this unit exists to fix.

import {
  isValidDutchBtw,
  isValidDutchPhone,
  isValidEmail,
  isValidWebsite,
} from '@/lib/validation/dutch'

export type BusinessPayload = {
  display_name: string
  trade_name: string
  btw_number: string
  contact_phone: string
  contact_email: string
  website: string
  cuisine_type: string
}

export type BusinessError = { code: string; message: string }

export const MAX_DISPLAY_NAME_LENGTH = 80
export const MAX_TRADE_NAME_LENGTH = 80
export const MAX_CUISINE_TYPE_LENGTH = 40

/**
 * Parse an untrusted request body into a BusinessPayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Business rules are validateBusinessPayload's job.
 */
export function parseBusinessPayload(raw: unknown): BusinessPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.display_name !== 'string') return null
  if (typeof b.trade_name !== 'string') return null
  if (typeof b.btw_number !== 'string') return null
  if (typeof b.contact_phone !== 'string') return null
  if (typeof b.contact_email !== 'string') return null
  if (typeof b.website !== 'string') return null
  if (typeof b.cuisine_type !== 'string') return null

  return {
    display_name: b.display_name,
    trade_name: b.trade_name,
    btw_number: b.btw_number.trim().toUpperCase(),
    contact_phone: b.contact_phone,
    contact_email: b.contact_email,
    website: b.website,
    cuisine_type: b.cuisine_type,
  }
}

/**
 * Business rules for a business-details save payload. Returns the first
 * violation found (deterministic check order) as a single { code, message },
 * or null when the payload is fully valid. BTW uniqueness is NOT checked
 * here — that requires a DB round trip and lives in the route, mirroring
 * the kvk_already_linked / btw_already_linked pattern from BTW-1.
 */
export function validateBusinessPayload(
  payload: BusinessPayload
): BusinessError | null {
  const displayName = payload.display_name.trim()
  if (displayName.length === 0) {
    return { code: 'validation_error', message: 'display_name is required.' }
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { code: 'validation_error', message: 'display_name is too long.' }
  }
  if (payload.trade_name.trim().length > MAX_TRADE_NAME_LENGTH) {
    return { code: 'validation_error', message: 'trade_name is too long.' }
  }
  if (!isValidDutchBtw(payload.btw_number)) {
    return { code: 'validation_error', message: 'Invalid BTW number format.' }
  }
  if (!isValidDutchPhone(payload.contact_phone)) {
    return { code: 'validation_error', message: 'Invalid phone number.' }
  }
  if (!isValidEmail(payload.contact_email)) {
    return { code: 'validation_error', message: 'Invalid email address.' }
  }
  if (!isValidWebsite(payload.website)) {
    return { code: 'validation_error', message: 'Invalid website URL.' }
  }
  if (payload.cuisine_type.trim().length > MAX_CUISINE_TYPE_LENGTH) {
    return { code: 'validation_error', message: 'cuisine_type is too long.' }
  }

  return null
}
