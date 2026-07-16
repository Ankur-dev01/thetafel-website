// lib/consumer/notifications/dispatchDataDeletion.ts
//
// GDPR data-deletion dispatcher (C8.2). Mirrors dispatchDataExport.ts: the
// initial "click to confirm" link email, and the follow-up confirmation
// email carrying the deletion-summary PDF as an attachment.

import 'server-only'
import { auditLog, PLATFORM_RESTAURANT_ID } from '../audit'
import {
  renderDataDeletionLink,
  renderDataDeletionConfirmation,
} from '../email/templates/dataDeletion'
import { sendConsumerEmail } from '../email/send'
import type { EmailLocale } from '../email/layout'

export type DispatchResult = {
  ok: boolean
  emailId?: string
  error?: string
}

export async function sendDataDeletionLinkEmail(input: {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  verifyUrl: string
}): Promise<DispatchResult> {
  let result: DispatchResult
  try {
    const rendered = renderDataDeletionLink({
      locale: input.locale,
      guestFullName: input.guestFullName,
      verifyUrl: input.verifyUrl,
    })

    const send = await sendConsumerEmail({
      to: input.guestEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'privacy.data_deletion_link',
      restaurantId: PLATFORM_RESTAURANT_ID,
      skipAdminBcc: true,
    })

    result = send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchDataDeletion] link email failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'privacy_data_deletion_link',
      locale: input.locale,
      email: { ok: result.ok, id: result.emailId ?? null, error: result.error ?? null },
    },
    actorType: 'system',
  }).catch(() => {})

  return result
}

export async function sendDataDeletionFileEmail(input: {
  locale: EmailLocale
  originalEmail: string
  requestReference: string
  pdfBuffer: Buffer
}): Promise<DispatchResult> {
  let result: DispatchResult
  try {
    const rendered = renderDataDeletionConfirmation({
      locale: input.locale,
      requestReference: input.requestReference,
    })

    const send = await sendConsumerEmail({
      to: input.originalEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'privacy.data_deletion_file',
      restaurantId: PLATFORM_RESTAURANT_ID,
      skipAdminBcc: true,
      attachments: [
        {
          filename: `thetafel-data-deletion-${input.requestReference}.pdf`,
          content: input.pdfBuffer,
        },
      ],
    })

    result = send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchDataDeletion] confirmation email failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'privacy_data_deletion_file',
      locale: input.locale,
      requestReference: input.requestReference,
      email: { ok: result.ok, id: result.emailId ?? null, error: result.error ?? null },
    },
    actorType: 'system',
  }).catch(() => {})

  return result
}
