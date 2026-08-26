import 'server-only'
import { Resend } from 'resend'
import { auditLog } from '../audit'

/**
 * Single entry point for every consumer-facing email send.
 *
 * Wraps the Resend client, BCCs hello@thetafel.nl so the team can see all
 * outgoing consumer mail for support / debugging, audits the result.
 *
 * Never throws — a failed email never blocks the user-visible action that
 * triggered it. A booking still confirms in the DB even if its confirmation
 * email failed to send; the guest can re-request via the manage page.
 *
 * Resend's idempotency is per-send: we don't dedupe at this layer. If you
 * call sendConsumerEmail twice for the same booking, the guest gets two
 * emails. Upstream code (booking-create, etc.) is responsible for not
 * triggering duplicate sends — usually by gating on a state-machine
 * transition that only fires once.
 */

let _resend: Resend | null = null
function getResend(): Resend {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  _resend = new Resend(key)
  return _resend
}

// Error names the Resend API returns for a genuinely bad request — retrying
// these wastes time since the same input fails the same way every time. A
// booking confirmation (TFL-0BBSUZ, 2026-08-08) was lost to a single
// "Unable to fetch data. The request could not be resolved." failure — a
// raw fetch/DNS error from the SDK's transport layer, not one of these
// codes — surrounded by weeks of otherwise-successful sends. That shape is
// exactly what a retry is for: anything NOT in this set (thrown exceptions
// included) gets retried a couple of times with backoff before giving up.
const NON_RETRYABLE_ERROR_NAMES = new Set([
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'not_found',
  'method_not_allowed',
  'invalid_idempotency_key',
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_access',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
  'security_error',
])

const RETRY_DELAYS_MS = [400, 1200]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type SendConsumerEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  /** For audit + tracing — short snake_case label e.g. 'booking.confirmation'. */
  templateKey: string
  /** For audit. */
  restaurantId: string
  bookingId?: string | null
  orderId?: string | null
  /** Extra recipients for the BCC list. hello@thetafel.nl is always BCC'd unless skipAdminBcc is set. */
  extraBcc?: string[]
  /** Skip the default hello@thetafel.nl BCC — for sends where an admin copy isn't wanted (e.g. cancellations). */
  skipAdminBcc?: boolean
  /** Reply-To override — used for internal notifications the guest should be able to reply to directly. */
  replyTo?: string
  /** Resend attachments — CID images, ICS, etc. */
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentId?: string
  }>
}

export type SendConsumerEmailResult =
  | { ok: true; resendId: string }
  | { ok: false; reason: 'misconfigured' | 'send_failed'; error?: string }

/**
 * Send a single consumer email. Logs to console and writes an audit row
 * on both success and failure.
 */
export async function sendConsumerEmail(
  input: SendConsumerEmailInput
): Promise<SendConsumerEmailResult> {
  let resend: Resend
  try {
    resend = getResend()
  } catch (err) {
    console.error('[sendConsumerEmail] missing config', err)
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'email.send_failed',
      eventData: { templateKey: input.templateKey, reason: 'misconfigured' },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
    })
    return { ok: false, reason: 'misconfigured', error: 'RESEND_API_KEY missing' }
  }

  const bcc = input.skipAdminBcc
    ? (input.extraBcc ?? [])
    : ['hello@thetafel.nl', ...(input.extraBcc ?? [])]

  let lastFailure: { reason: 'resend_error' | 'exception'; message: string | undefined } | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1])

    try {
      const { data, error } = await resend.emails.send({
        from: 'The Tafel <hallo@thetafel.nl>',
        to: [input.to],
        bcc,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      })

      if (error || !data) {
        const retryable = !error?.name || !NON_RETRYABLE_ERROR_NAMES.has(error.name)
        console.error('[sendConsumerEmail] resend error', {
          templateKey: input.templateKey,
          to: input.to.replace(/(.).+(@.+)/, '$1***$2'),
          error: error?.message ?? 'no data returned',
          attempt,
          willRetry: retryable && attempt < RETRY_DELAYS_MS.length,
        })
        lastFailure = { reason: 'resend_error', message: error?.message }
        if (retryable && attempt < RETRY_DELAYS_MS.length) continue
        break
      }

      console.log('[sendConsumerEmail] sent', {
        templateKey: input.templateKey,
        resendId: data.id,
        attempt,
      })

      await auditLog({
        restaurantId: input.restaurantId,
        eventType: 'email.sent',
        eventData: { templateKey: input.templateKey, resendId: data.id, attempt },
        actorType: 'system',
        bookingId: input.bookingId ?? null,
        orderId: input.orderId ?? null,
      })

      return { ok: true, resendId: data.id }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[sendConsumerEmail] unexpected error', { err, attempt })
      lastFailure = { reason: 'exception', message }
      if (attempt < RETRY_DELAYS_MS.length) continue
      break
    }
  }

  await auditLog({
    restaurantId: input.restaurantId,
    eventType: 'email.send_failed',
    eventData: {
      templateKey: input.templateKey,
      reason: lastFailure?.reason ?? 'resend_error',
      message: lastFailure?.message ?? null,
      attempts: RETRY_DELAYS_MS.length + 1,
    },
    actorType: 'system',
    bookingId: input.bookingId ?? null,
    orderId: input.orderId ?? null,
  })
  return { ok: false, reason: 'send_failed', error: lastFailure?.message }
}
