import 'server-only'
import { Resend } from 'resend'
import { auditLog } from '../audit'

/**
 * Single entry point for every consumer-facing email send.
 *
 * Wraps the Resend client, BCCs hallo@thetafel.nl so the team can see all
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
  /** Extra recipients for the BCC list. hallo@thetafel.nl is always BCC'd. */
  extraBcc?: string[]
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

  const bcc = ['hallo@thetafel.nl', ...(input.extraBcc ?? [])]

  try {
    const { data, error } = await resend.emails.send({
      from: 'The Tafel <hallo@thetafel.nl>',
      to: [input.to],
      bcc,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    })

    if (error || !data) {
      console.error('[sendConsumerEmail] resend error', {
        templateKey: input.templateKey,
        to: input.to.replace(/(.).+(@.+)/, '$1***$2'),
        error: error?.message ?? 'no data returned',
      })
      await auditLog({
        restaurantId: input.restaurantId,
        eventType: 'email.send_failed',
        eventData: {
          templateKey: input.templateKey,
          reason: 'resend_error',
          message: error?.message ?? null,
        },
        actorType: 'system',
        bookingId: input.bookingId ?? null,
        orderId: input.orderId ?? null,
      })
      return { ok: false, reason: 'send_failed', error: error?.message }
    }

    console.log('[sendConsumerEmail] sent', {
      templateKey: input.templateKey,
      resendId: data.id,
    })

    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'email.sent',
      eventData: { templateKey: input.templateKey, resendId: data.id },
      actorType: 'system',
      bookingId: input.bookingId ?? null,
      orderId: input.orderId ?? null,
    })

    return { ok: true, resendId: data.id }
  } catch (err) {
    console.error('[sendConsumerEmail] unexpected error', err)
    await auditLog({
      restaurantId: input.restaurantId,
      eventType: 'email.send_failed',
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
