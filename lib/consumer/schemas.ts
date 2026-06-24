import 'server-only'
import { z } from 'zod'
import {
  coerceBoolean,
  coerceInteger,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  sanitizeCompanyName,
  sanitizeItemNote,
  sanitizeName,
  sanitizeNote,
} from './sanitize'

/**
 * Zod schemas for consumer-facing endpoints.
 *
 * Each schema runs sanitisation via `.preprocess`, then validates the result.
 * The output type is the cleaned, canonical shape — no nullable strings, no
 * loose formats.
 *
 * Per-endpoint schemas (booking-submit, order-submit, etc.) live near their
 * API routes (C4+) and compose these base schemas via `.extend()` or spread.
 */

/**
 * Reusable email field. Lowercased + trimmed by preprocess. Validation
 * matches the DB CHECK constraint on guests.email.
 *
 * Falls back to raw string (not null) so zod's type check passes and our
 * friendly refine message fires instead of "Expected string, received null".
 */
export const emailField = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return ''
    return normalizeEmail(v) ?? v
  },
  z
    .string({ required_error: 'Email is required.' })
    .min(1, 'Email is required.')
    .max(254, 'Email is too long.')
    .refine(isValidEmail, 'Please enter a valid email address.')
)

/**
 * Reusable phone field. Normalises Dutch national and intl-without-plus to
 * E.164 by preprocess. Validates the E.164 form matches DB CHECK.
 *
 * Falls back to raw string (not null) so the refine fires the friendly
 * message instead of zod's internal type error.
 */
export const phoneField = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return ''
    return normalizePhone(v) ?? v
  },
  z
    .string({
      required_error:
        'Phone number is required. Use international format e.g. +31 6 12345678.',
    })
    .min(1, 'Phone number is required.')
    .refine(
      isValidPhone,
      'Please enter a valid phone number in international format.'
    )
)

/**
 * Reusable full-name field. Stripped of control chars, whitespace collapsed,
 * trimmed, length-capped by preprocess.
 */
export const fullNameField = z.preprocess(
  sanitizeName,
  z
    .string({ required_error: 'Your name is required.' })
    .min(2, 'Please enter your full name.')
    .max(100, 'Name is too long.')
)

/**
 * Optional multi-line note (booking / order). Empty/whitespace-only → undefined.
 */
export const noteField = z.preprocess(
  (v) => sanitizeNote(v) ?? undefined,
  z.string().max(500).optional()
)

/** Optional single-line item modifier note. */
export const itemNoteField = z.preprocess(
  (v) => sanitizeItemNote(v) ?? undefined,
  z.string().max(200).optional()
)

/** Optional company name for takeaway invoice. */
export const companyNameField = z.preprocess(
  (v) => sanitizeCompanyName(v) ?? undefined,
  z.string().max(100).optional()
)

/** Marketing consent — coerces truthy values. Defaults false. */
export const marketingConsentField = z.preprocess(
  coerceBoolean,
  z.boolean().default(false)
)

/**
 * Party size — coerces integer, enforces DB range 1..50. Online booking
 * defaults further restrict via restaurants.max_party_size_online but that
 * lives in the per-restaurant validation, not here.
 */
export const partySizeField = z.preprocess(
  coerceInteger,
  z
    .number({ required_error: 'Party size is required.' })
    .int()
    .min(1, 'Party size must be at least 1.')
    .max(50, 'Party size must be 50 or fewer.')
)

// ── Composed schemas ────────────────────────────────────────────────────────

/**
 * The guest identity block — used by every consumer write that creates or
 * looks up a guest (booking, takeaway order, QR pay-now order).
 *
 * Per-endpoint schemas spread or extend this.
 */
export const guestInputSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  phone: phoneField,
  marketingConsent: marketingConsentField,
})

export type GuestInput = z.infer<typeof guestInputSchema>

/**
 * Helper that turns a Zod error into a flat `{ field: message }` object
 * the API route can return as JSON. Caller still wraps it in the standard
 * `{ error, code: 'validation_failed', fields }` envelope.
 */
export function flattenZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (path && !out[path]) {
      out[path] = issue.message
    }
  }
  return out
}
