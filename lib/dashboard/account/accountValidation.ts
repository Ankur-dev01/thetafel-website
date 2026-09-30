// Hand-rolled validators for the /dashboard/settings/account forms. Shared by
// the client forms (instant feedback) and the API routes (authoritative).

export const DISPLAY_NAME_MAX = 80
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: string }

export function validateDisplayName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, code: 'invalid_name' }
  const value = raw.trim()
  if (value.length < 1 || value.length > DISPLAY_NAME_MAX) return { ok: false, code: 'invalid_name' }
  return { ok: true, value }
}

export function validateAccountEmail(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, code: 'invalid_email' }
  const value = raw.trim().toLowerCase()
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, code: 'invalid_email' }
  }
  return { ok: true, value }
}

export function validateNewPassword(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, code: 'password_too_short' }
  if (raw.length < PASSWORD_MIN) return { ok: false, code: 'password_too_short' }
  if (raw.length > PASSWORD_MAX) return { ok: false, code: 'password_too_long' }
  return { ok: true, value: raw }
}

export function parseLocale(raw: unknown): 'nl' | 'en' | null {
  return raw === 'nl' || raw === 'en' ? raw : null
}
