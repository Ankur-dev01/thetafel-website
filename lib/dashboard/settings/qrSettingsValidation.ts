// lib/dashboard/settings/qrSettingsValidation.ts
//
// Shared QR-settings-payload validation, imported by BOTH the client editor
// and the mutating route. The client copy is UX only — the server always
// re-validates the parsed payload, and separately re-checks
// `service_qr_enabled` against a fresh DB read (never the client's copy)
// before writing.
//
// Writes `qr_item_notes_enabled` only — never the sibling
// `qr_item_notes_allowed` column, which D5.5's migration drops. Onboarding's
// qr-setup step wrote exclusively to the doomed `qr_item_notes_allowed`
// column, meaning its item-notes toggle has never actually affected guest
// behaviour (the consumer QR menu has always read `qr_item_notes_enabled`
// only, which just sat at its DEFAULT TRUE). This is the first write path
// that actually connects the toggle to the column the guest experience reads.
//
// Server contract is a single { code, message } (matches D5.3/D5.4's idiom),
// not a field-level ValidationError[].

export type QrSettingsPayload = {
  qr_auto_accept: boolean
  qr_item_notes_enabled: boolean
  qr_menu_language: string
  qr_widget_accent_color: string
  qr_pay_now_enabled: boolean
  qr_pay_at_table_enabled: boolean
}

export type QrSettingsValidationContext = {
  /** Freshly reloaded server-side — never trust a client-supplied copy. */
  serviceQrEnabled: boolean
}

export type QrSettingsError = { code: string; message: string }

export const MENU_LANGUAGE_OPTIONS = ['nl', 'en', 'nl_en'] as const
/** Same 6-digit-hex-only regex used by onboarding's qr-setup step and the QR-generate route. */
export const ACCENT_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/**
 * Parse an untrusted request body into a QrSettingsPayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Business rules are validateQrSettingsPayload's job.
 */
export function parseQrSettingsPayload(raw: unknown): QrSettingsPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.qr_auto_accept !== 'boolean') return null
  if (typeof b.qr_item_notes_enabled !== 'boolean') return null
  if (typeof b.qr_menu_language !== 'string') return null
  if (typeof b.qr_widget_accent_color !== 'string') return null
  if (typeof b.qr_pay_now_enabled !== 'boolean') return null
  if (typeof b.qr_pay_at_table_enabled !== 'boolean') return null

  return {
    qr_auto_accept: b.qr_auto_accept,
    qr_item_notes_enabled: b.qr_item_notes_enabled,
    qr_menu_language: b.qr_menu_language,
    qr_widget_accent_color: b.qr_widget_accent_color,
    qr_pay_now_enabled: b.qr_pay_now_enabled,
    qr_pay_at_table_enabled: b.qr_pay_at_table_enabled,
  }
}

/**
 * Business rules for a QR-settings save payload. Returns the first
 * violation found (deterministic check order) as a single { code, message },
 * or null when the payload is fully valid. Server callers must pass a
 * FRESHLY reloaded `context` — never the client's copy of `service_qr_enabled`.
 */
export function validateQrSettingsPayload(
  payload: QrSettingsPayload,
  context: QrSettingsValidationContext,
): QrSettingsError | null {
  if (!context.serviceQrEnabled) {
    return { code: 'qr_not_enabled', message: 'QR ordering is not enabled for this restaurant.' }
  }

  if (!(MENU_LANGUAGE_OPTIONS as readonly string[]).includes(payload.qr_menu_language)) {
    return { code: 'menu_language_invalid', message: 'Invalid qr_menu_language.' }
  }
  if (!ACCENT_COLOR_RE.test(payload.qr_widget_accent_color)) {
    return { code: 'accent_color_invalid', message: 'qr_widget_accent_color must be a 6-digit hex colour like #d4820a.' }
  }
  if (!payload.qr_pay_now_enabled && !payload.qr_pay_at_table_enabled) {
    return {
      code: 'qr_needs_payment_method',
      message: 'At least one of pay-now or pay-at-table must be enabled.',
    }
  }

  return null
}
