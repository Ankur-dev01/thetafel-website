import 'server-only'
import { auditLog } from '../audit'
import { WHATSAPP_TEMPLATES, type WhatsAppTemplateKey } from './templates'

/**
 * Single entry point for every consumer-facing WhatsApp send.
 *
 * Behaviours:
 *   - WHATSAPP_ENABLED !== 'true' → { ok: false, reason: 'feature_disabled' }.
 *     The C3.3 dispatcher checks this and falls back to email.
 *   - WHATSAPP_TOKEN or WHATSAPP_PHONE_ID missing → 'misconfigured'.
 *   - Meta API call succeeds → { ok: true, messageId }.
 *   - Meta API call fails → { ok: false, reason: 'send_failed', error, metaErrorCode? }.
 *
 * Every send result is audit-logged. Phone numbers are masked in console
 * output (last 4 digits only). Never throws.
 */

const DEFAULT_API_VERSION = 'v20.0'

export type SendWhatsAppInput = {
  /** E.164 phone number, e.g. '+31612345678'. */
  to: string
  /** Template registry key — must exist in WHATSAPP_TEMPLATES. */
  templateKey: WhatsAppTemplateKey
  /** Body parameters in order. Length must equal template.bodyParameterCount. */
  bodyParameters: string[]
  /**
   * URL-button parameters. One array per button defined in the template.
   * Each inner array is the parameters for that button's URL placeholders.
   * For our current templates, button 0 takes [slug, magicToken].
   */
  buttonParameters?: string[][]
  /** Audit metadata. */
  restaurantId: string
  bookingId?: string | null
  orderId?: string | null
}

export type SendWhatsAppResult =
  | { ok: true; messageId: string }
  | {
      ok: false
      reason:
        | 'feature_disabled'
        | 'misconfigured'
        | 'invalid_template'
        | 'invalid_parameters'
        | 'send_failed'
      error?: string
      metaErrorCode?: number
    }

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '***'
  return `***${phone.slice(-4)}`
}

export async function sendWhatsAppMessage(
  input: SendWhatsAppInput
): Promise<SendWhatsAppResult> {
  const enabled = process.env.WHATSAPP_ENABLED === 'true'
  if (!enabled) {
    return { ok: false, reason: 'feature_disabled' }
  }

  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const apiVersion = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION

  if (!token || !phoneId) {
    console.error('[whatsapp] missing config', {
      hasToken: !!token,
      hasPhoneId: !!phoneId,
    })
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'whatsapp.send_failed',
      eventData: { templateKey: input.templateKey, reason: 'misconfigured' },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
    })
    return { ok: false, reason: 'misconfigured' }
  }

  const template = WHATSAPP_TEMPLATES[input.templateKey]
  if (!template) {
    return { ok: false, reason: 'invalid_template' }
  }

  if (input.bodyParameters.length !== template.bodyParameterCount) {
    return {
      ok: false,
      reason: 'invalid_parameters',
      error: `Template ${input.templateKey} expects ${template.bodyParameterCount} body parameters, got ${input.bodyParameters.length}`,
    }
  }

  // Build Meta Graph API request body.
  const components: Array<Record<string, unknown>> = []

  if (template.bodyParameterCount > 0) {
    components.push({
      type: 'body',
      parameters: input.bodyParameters.map((text) => ({ type: 'text', text })),
    })
  }

  // One button component per URL-button index.
  template.buttons.forEach((btn, idx) => {
    if (btn.type !== 'URL') return
    const params = input.buttonParameters?.[idx] ?? []
    if (params.length === 0) return
    components.push({
      type: 'button',
      sub_type: 'url',
      index: String(idx),
      parameters: params.map((text) => ({ type: 'text', text })),
    })
  })

  const requestBody = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: input.to.replace(/^\+/, ''), // Meta wants the number without leading +
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.metaLanguageCode },
      components,
    },
  }

  const apiUrl = `https://graph.facebook.com/${apiVersion}/${phoneId}/messages`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeoutId)

    const json = (await response.json()) as {
      messages?: Array<{ id: string }>
      error?: { message?: string; code?: number; error_subcode?: number }
    }

    if (!response.ok || json.error) {
      console.error('[whatsapp] send failed', {
        templateKey: input.templateKey,
        to: maskPhone(input.to),
        status: response.status,
        metaCode: json.error?.code,
        message: json.error?.message,
      })
      await auditLog({
        restaurantId: input.restaurantId,
        eventType: 'whatsapp.send_failed',
        eventData: {
          templateKey: input.templateKey,
          reason: 'meta_error',
          metaCode: json.error?.code ?? null,
          message: json.error?.message ?? null,
        },
        actorType: 'system',
        bookingId: input.bookingId ?? null,
        orderId: input.orderId ?? null,
      })
      return {
        ok: false,
        reason: 'send_failed',
        error: json.error?.message,
        metaErrorCode: json.error?.code,
      }
    }

    const messageId = json.messages?.[0]?.id ?? ''
    console.log('[whatsapp] sent', {
      templateKey: input.templateKey,
      to: maskPhone(input.to),
      messageId,
    })
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'whatsapp.sent',
      eventData: { templateKey: input.templateKey, messageId },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
    })
    return { ok: true, messageId }
  } catch (err) {
    console.error('[whatsapp] unexpected error', err)
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'whatsapp.send_failed',
      eventData: {
        templateKey: input.templateKey,
        reason: 'exception',
        error: err instanceof Error ? err.message : String(err),
      },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
    })
    return {
      ok: false,
      reason: 'send_failed',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Whether WhatsApp is currently enabled. Cheap check for the dispatcher. */
export function isWhatsAppEnabled(): boolean {
  return process.env.WHATSAPP_ENABLED === 'true'
}
