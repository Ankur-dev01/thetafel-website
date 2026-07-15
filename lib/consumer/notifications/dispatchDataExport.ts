// lib/consumer/notifications/dispatchDataExport.ts
//
// GDPR data-export dispatcher (C8.1). Two sends, mirroring
// dispatchCancellation's shape: the initial "click to confirm" link email,
// and the follow-up email carrying the JSON export as an attachment.

import 'server-only'
import { auditLog, PLATFORM_RESTAURANT_ID } from '../audit'
import {
  renderDataExportLink,
  renderDataExportConfirmation,
} from '../email/templates/dataExport'
import { sendConsumerEmail } from '../email/send'
import type { EmailLocale } from '../email/layout'
import type { ExportPayload } from '../privacy/buildDataExport'

export type DispatchResult = {
  ok: boolean
  emailId?: string
  error?: string
}

export async function sendDataExportLinkEmail(input: {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  verifyUrl: string
}): Promise<DispatchResult> {
  let result: DispatchResult
  try {
    const rendered = renderDataExportLink({
      locale: input.locale,
      guestFullName: input.guestFullName,
      verifyUrl: input.verifyUrl,
    })

    const send = await sendConsumerEmail({
      to: input.guestEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'privacy.data_export_link',
      restaurantId: PLATFORM_RESTAURANT_ID,
      skipAdminBcc: true,
    })

    result = send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchDataExport] link email failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'privacy_data_export_link',
      locale: input.locale,
      email: { ok: result.ok, id: result.emailId ?? null, error: result.error ?? null },
    },
    actorType: 'system',
  }).catch(() => {})

  return result
}

export async function sendDataExportFileEmail(input: {
  locale: EmailLocale
  guestFullName: string
  guestEmail: string
  payload: ExportPayload
}): Promise<DispatchResult> {
  let result: DispatchResult
  try {
    const rendered = renderDataExportConfirmation({
      locale: input.locale,
      guestFullName: input.guestFullName,
      requestReference: input.payload.request_reference,
    })

    const send = await sendConsumerEmail({
      to: input.guestEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      templateKey: 'privacy.data_export_file',
      restaurantId: PLATFORM_RESTAURANT_ID,
      skipAdminBcc: true,
      attachments: [
        {
          filename: `thetafel-data-export-${input.payload.request_reference}.json`,
          content: Buffer.from(JSON.stringify(input.payload, null, 2), 'utf-8'),
        },
      ],
    })

    result = send.ok
      ? { ok: true, emailId: send.resendId }
      : { ok: false, error: send.error ?? send.reason }
  } catch (err) {
    console.error('[dispatchDataExport] file email failed', err)
    result = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  await auditLog({
    restaurantId: PLATFORM_RESTAURANT_ID,
    eventType: 'notification.dispatched',
    eventData: {
      intent: 'privacy_data_export_file',
      locale: input.locale,
      requestReference: input.payload.request_reference,
      email: { ok: result.ok, id: result.emailId ?? null, error: result.error ?? null },
    },
    actorType: 'system',
  }).catch(() => {})

  return result
}
