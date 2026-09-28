// lib/dashboard/settings/brandingValidation.ts
//
// Shared branding-color-payload validation, imported by BOTH the client
// form and the mutating route, same posture as businessValidation /
// qrSettingsValidation. The client copy is UX only — the server always
// re-validates the parsed payload before writing.
//
// Same hex format as qrSettingsValidation's ACCENT_COLOR_RE — D5.7 writes
// both brand_primary_hex and qr_widget_accent_color from one payload, so
// the two columns must accept exactly the same format or the two settings
// pages could disagree on what's valid.

export type BrandingColorPayload = {
  primary_hex: string
}

export type BrandingError = { code: string; message: string }

/** Same 6-digit-hex-only regex as qrSettingsValidation's ACCENT_COLOR_RE. */
export const BRAND_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/**
 * Parse an untrusted request body into a BrandingColorPayload shape.
 * Returns null when the body isn't even shaped like one — callers answer
 * 400 invalid_body. Business rules are validateBrandingColorPayload's job.
 */
export function parseBrandingColorPayload(raw: unknown): BrandingColorPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.primary_hex !== 'string') return null

  return {
    primary_hex: b.primary_hex.trim().toLowerCase(),
  }
}

export function validateBrandingColorPayload(
  payload: BrandingColorPayload
): BrandingError | null {
  if (!BRAND_COLOR_RE.test(payload.primary_hex)) {
    return { code: 'color_invalid', message: 'primary_hex must be a 6-digit hex colour like #d4820a.' }
  }
  return null
}
