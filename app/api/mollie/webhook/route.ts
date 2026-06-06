import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import {
  verifyMollieSignature,
  getMollieSignatureHeaderName,
  mapOnboardingStatus,
  fetchOnboardingStatus,
  getValidAccessTokenForRestaurant,
  type MollieStatus,
} from '@/lib/mollie/webhook'

// Force Node.js runtime — crypto.createHmac and Buffer aren't available on Edge.
export const runtime = 'nodejs'

interface MollieEventPayload {
  id?: string
  type?: string
  createdAt?: string
  _embedded?: {
    organization?: { id?: string }
    payment?: { id?: string }
    subscription?: { id?: string }
    mandate?: { id?: string }
  }
}

function extractOrganizationId(payload: MollieEventPayload): string | null {
  return payload?._embedded?.organization?.id ?? null
}

export async function POST(req: NextRequest) {
  // 1. Read raw body once — signature is HMAC over raw bytes.
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'cannot_read_body' }, { status: 400 })
  }

  // 2. Signature verification (or dev bypass).
  const devBypass = process.env.MOLLIE_DEV_BYPASS_WEBHOOK_SIGNATURE === 'true'
  if (devBypass) {
    if (process.env.NODE_ENV === 'production') {
      // Hard refuse in production even if the flag is set — defence in depth.
      return NextResponse.json({ error: 'dev_bypass_not_allowed_in_production' }, { status: 403 })
    }
    // eslint-disable-next-line no-console
    console.warn('[mollie/webhook] signature verification skipped (dev bypass)')
  } else {
    const secret = process.env.MOLLIE_WEBHOOK_SIGNING_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'signing_secret_not_configured' }, { status: 500 })
    }
    const sigHeader = req.headers.get(getMollieSignatureHeaderName())
    const ok = verifyMollieSignature(rawBody, sigHeader, secret)
    if (!ok) {
      return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
    }
  }

  // 3. Parse body now that signature is verified.
  let payload: MollieEventPayload
  try {
    payload = JSON.parse(rawBody) as MollieEventPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventId = payload?.id
  const eventType = payload?.type
  if (!eventId || !eventType) {
    return NextResponse.json({ error: 'missing_event_fields' }, { status: 400 })
  }

  // 4. Idempotency + persistence — admin client (webhook has no session).
  const admin = await createSupabaseServerClientAdmin()

  // 4a. Already processed — ack and exit.
  const { data: existing } = await admin
    .from('mollie_webhook_events')
    .select('id, processed_at')
    .eq('mollie_event_id', eventId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
  }

  // 4b. Insert the raw event before doing any work so a crash mid-processing
  //     still leaves an audit trail. The unique constraint protects against
  //     concurrent duplicate delivery.
  const { data: inserted, error: insertErr } = await admin
    .from('mollie_webhook_events')
    .insert({
      mollie_event_id: eventId,
      event_type: eventType,
      payload: payload as unknown as Record<string, unknown>,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    // Unique constraint tripped between our SELECT and INSERT — treat as duplicate.
    if (insertErr?.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 })
    }
    return NextResponse.json({ error: 'event_persist_failed' }, { status: 500 })
  }

  // 5. Process by event type.
  let processingError: string | null = null
  let restaurantId: string | null = null

  try {
    switch (eventType) {
      case 'organization.updated': {
        restaurantId = await handleOrganizationUpdated(admin, payload)
        break
      }
      // Accepted, persisted, acked — handlers land with booking engine / subscription unit.
      case 'payment.paid':
      case 'payment.failed':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'mandate.revoked':
      default:
        break
    }
  } catch (err) {
    processingError = err instanceof Error ? err.message : 'unknown_processing_error'
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(`[mollie/webhook] processing failed for ${eventType} ${eventId}:`, processingError)
    }
  }

  // 6. Mark the event row processed — always, even on error. Mollie retries
  //    on 5xx, so we capture the error and still record the attempt.
  await admin
    .from('mollie_webhook_events')
    .update({
      processed_at: new Date().toISOString(),
      processing_error: processingError,
    })
    .eq('id', inserted.id)

  // 7. Audit log — best-effort, never blocks the ack.
  try {
    await admin.from('audit_logs').insert({
      event_type: `mollie.${eventType}`,
      restaurant_id: restaurantId,
      event_data: {
        mollie_event_id: eventId,
        event_type: eventType,
        processing_error: processingError,
      },
    })
  } catch {
    // Audit failure must not break webhook ack.
  }

  // 8. 500 on processing error so Mollie retries; 200 otherwise.
  if (processingError) {
    return NextResponse.json({ ok: false, error: processingError }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

async function handleOrganizationUpdated(
  admin: Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>,
  payload: MollieEventPayload
): Promise<string | null> {
  const orgId = extractOrganizationId(payload)
  if (!orgId) {
    throw new Error('organization_id_missing_from_payload')
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id')
    .eq('mollie_organization_id', orgId)
    .maybeSingle()

  if (error || !restaurant) {
    // Unknown org — stale webhook from a removed connection. No-op.
    return null
  }

  const accessToken = await getValidAccessTokenForRestaurant(admin, restaurant.id)
  const onboardingStatus = await fetchOnboardingStatus(accessToken)
  const next: MollieStatus = mapOnboardingStatus(onboardingStatus)

  const updatePayload: Record<string, unknown> = { mollie_status: next }
  if (next === 'verified') {
    updatePayload.mollie_verified_at = new Date().toISOString()
  }

  const { error: updateErr } = await admin
    .from('restaurants')
    .update(updatePayload)
    .eq('id', restaurant.id)

  if (updateErr) {
    throw new Error(`restaurant_update_failed:${updateErr.message}`)
  }

  return restaurant.id
}
