import 'server-only'

/**
 * WhatsApp template registry — single source of truth for what we've
 * submitted to Meta Business Manager for approval.
 *
 * Each entry's `submissionBody` is the EXACT text to paste into Meta's
 * template-creation form when submitting for approval. If you change the
 * wording here, you must also re-submit the template to Meta — they re-
 * approve on body change.
 *
 * Category rules (per Meta WhatsApp Business policy):
 *   - UTILITY: account updates, confirmations, transactional. All our use cases.
 *   - MARKETING: promotional. Stricter approval, often rejected.
 *   - AUTHENTICATION: one-time passcodes only.
 *
 * Languages: Meta requires a separate template per language. booking_confirmation_nl
 * and booking_confirmation_en are TWO templates from Meta's perspective.
 */

export type WhatsAppCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
export type WhatsAppLocale = 'nl' | 'en'

export type WhatsAppTemplateDefinition = {
  /** Template name as registered with Meta — alphanumeric + underscores, lowercase. */
  name: string
  /** ISO 639-1 + country variant. Meta uses 'nl' for Dutch, 'en_US' for English (US). */
  metaLanguageCode: string
  locale: WhatsAppLocale
  category: WhatsAppCategory
  /**
   * Exact body submission text. {{1}} {{2}} placeholders refer to body parameter
   * positions (1-indexed). This text is what Meta sees during approval.
   */
  submissionBody: string
  /** Number of body parameters this template expects. Must match {{N}} count in submissionBody. */
  bodyParameterCount: number
  /** Optional header text — included in the approval request. */
  submissionHeader?: string
  /** Optional footer text — small grey line under body. */
  submissionFooter?: string
  /**
   * URL button definitions. Each gets ONE {{1}} placeholder in the URL
   * (the dynamic part). The static URL prefix is fixed at submission time.
   */
  buttons: Array<{
    type: 'URL'
    text: string
    /** Full URL with {{1}} placeholder at the end. */
    urlTemplate: string
  }>
}

/**
 * The six initial templates for Phase 2 consumer flows.
 *
 * Booking:
 *   - booking_confirmation_nl / _en   → sent immediately on booking creation
 *   - booking_reminder_nl / _en       → 24h before slot_time (cron job, C9)
 *
 * Order:
 *   - order_ready_nl / _en            → when restaurant marks takeaway order ready
 */
export const WHATSAPP_TEMPLATES = {
  booking_confirmation_nl: {
    name: 'booking_confirmation_nl',
    metaLanguageCode: 'nl',
    locale: 'nl',
    category: 'UTILITY',
    submissionHeader: 'Reservering bevestigd',
    submissionBody:
      'Hi {{1}}, je reservering bij {{2}} voor {{3}} personen op {{4}} is bevestigd. Referentie: {{5}}.',
    bodyParameterCount: 5,
    submissionFooter: 'The Tafel',
    buttons: [
      {
        type: 'URL',
        text: 'Wijzigen of annuleren',
        urlTemplate: 'https://thetafel.nl/r/{{1}}/bookings/manage?t={{2}}',
      },
    ],
  },

  booking_confirmation_en: {
    name: 'booking_confirmation_en',
    metaLanguageCode: 'en_US',
    locale: 'en',
    category: 'UTILITY',
    submissionHeader: 'Booking confirmed',
    submissionBody:
      'Hi {{1}}, your booking at {{2}} for {{3}} guests on {{4}} is confirmed. Reference: {{5}}.',
    bodyParameterCount: 5,
    submissionFooter: 'The Tafel',
    buttons: [
      {
        type: 'URL',
        text: 'Modify or cancel',
        urlTemplate: 'https://thetafel.nl/en/r/{{1}}/bookings/manage?t={{2}}',
      },
    ],
  },

  booking_reminder_nl: {
    name: 'booking_reminder_nl',
    metaLanguageCode: 'nl',
    locale: 'nl',
    category: 'UTILITY',
    submissionHeader: 'Herinnering',
    submissionBody:
      'Hi {{1}}, een herinnering: je reservering bij {{2}} is morgen om {{3}}. Tot dan.',
    bodyParameterCount: 3,
    submissionFooter: 'The Tafel',
    buttons: [
      {
        type: 'URL',
        text: 'Wijzigen of annuleren',
        urlTemplate: 'https://thetafel.nl/r/{{1}}/bookings/manage?t={{2}}',
      },
    ],
  },

  booking_reminder_en: {
    name: 'booking_reminder_en',
    metaLanguageCode: 'en_US',
    locale: 'en',
    category: 'UTILITY',
    submissionHeader: 'Reminder',
    submissionBody:
      'Hi {{1}}, a reminder: your booking at {{2}} is tomorrow at {{3}}. See you then.',
    bodyParameterCount: 3,
    submissionFooter: 'The Tafel',
    buttons: [
      {
        type: 'URL',
        text: 'Modify or cancel',
        urlTemplate: 'https://thetafel.nl/en/r/{{1}}/bookings/manage?t={{2}}',
      },
    ],
  },

  order_ready_nl: {
    name: 'order_ready_nl',
    metaLanguageCode: 'nl',
    locale: 'nl',
    category: 'UTILITY',
    submissionHeader: 'Bestelling klaar',
    submissionBody:
      'Hi {{1}}, je bestelling bij {{2}} (ref {{3}}) is klaar om opgehaald te worden.',
    bodyParameterCount: 3,
    submissionFooter: 'The Tafel',
    buttons: [],
  },

  order_ready_en: {
    name: 'order_ready_en',
    metaLanguageCode: 'en_US',
    locale: 'en',
    category: 'UTILITY',
    submissionHeader: 'Order ready',
    submissionBody:
      'Hi {{1}}, your order at {{2}} (ref {{3}}) is ready for pickup.',
    bodyParameterCount: 3,
    submissionFooter: 'The Tafel',
    buttons: [],
  },
} as const satisfies Record<string, WhatsAppTemplateDefinition>

export type WhatsAppTemplateKey = keyof typeof WHATSAPP_TEMPLATES

/**
 * Resolve a logical send-intent + locale to a concrete template key.
 *
 * Callers like the dispatcher (C3.3) say "booking_confirmation in nl";
 * this maps to 'booking_confirmation_nl' (the Meta template name).
 */
export function resolveTemplateKey(
  intent: 'booking_confirmation' | 'booking_reminder' | 'order_ready',
  locale: WhatsAppLocale
): WhatsAppTemplateKey {
  return `${intent}_${locale}` as WhatsAppTemplateKey
}
