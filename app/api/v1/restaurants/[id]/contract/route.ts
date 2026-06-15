import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import { renderContract } from '@/lib/contracts/render'
import { sendContractSignedEmail } from '@/lib/email/contract-signed'
import { CURRENT_CONTRACT_VERSION, CURRENT_TERMS_VERSION, CURRENT_DPA_VERSION } from '@/lib/legal/versions'
import { invalidateOnboardingLayout } from '@/lib/onboarding/cache'

const Body = z.object({
  full_name: z.string().trim().min(2).max(120),
  signature_data_url: z
    .string()
    .regex(/^data:image\/png;base64,/),
  authority_confirmed: z.literal(true),
  locale_signed: z.enum(['nl', 'en']),
  contract_version: z.literal('1.0'),
  document_hash: z.string().regex(/^[0-9a-f]{64}$/),
})

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // ── Step A — Auth ──────────────────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select(
        `id, user_id, current_onboarding_step,
         legal_name, kvk_number,
         legal_address_street, legal_address_house_number, legal_address_house_letter,
         legal_address_house_number_addition, legal_address_postcode, legal_address_city,
         service_reservations_enabled, service_takeaway_enabled, service_qr_enabled,
         subscription_tier`
      )
      .eq('id', restaurantId)
      .maybeSingle()

    if (restError || !restaurant) {
      return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
    }

    if (restaurant.user_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── Step B — Validate body ─────────────────────────────────────────────
    let body: z.infer<typeof Body>
    try {
      const raw = await req.json()
      body = Body.parse(raw)
    } catch (err) {
      const detail =
        err instanceof z.ZodError
          ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          : 'invalid json'
      return NextResponse.json(
        { error: 'invalid_body', detail },
        { status: 400 }
      )
    }

    // ── Step C — Read IP and user agent ────────────────────────────────────
    const headers = req.headers
    const signedIp =
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      '0.0.0.0'
    const signedUserAgent = (headers.get('user-agent') ?? '').slice(0, 500)

    // ── Step D — Re-render contract and compare hash ───────────────────────
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, trial_ends_at, monthly_amount_cents')
      .eq('restaurant_id', restaurantId)
      .in('status', ['trialing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: paymentsRaw } = await supabase
      .from('payments')
      .select('kind, status, amount_cents, description')
      .eq('restaurant_id', restaurantId)
      .like('kind', 'onetime_%')

    const payments = paymentsRaw ?? []

    if (!subscription) {
      return NextResponse.json({ error: 'subscription_not_found' }, { status: 422 })
    }

    const rendered = await renderContract(
      body.locale_signed,
      restaurant,
      subscription,
      payments
    )

    if (rendered.hash !== body.document_hash) {
      return NextResponse.json({ error: 'contract_changed' }, { status: 409 })
    }

    // ── Step E — Switch to admin client ────────────────────────────────────
    const admin = await createSupabaseServerClientAdmin()

    // ── Step F — Validate signature image ─────────────────────────────────
    const b64 = body.signature_data_url.split(',')[1] ?? ''
    const sigBuffer = Buffer.from(b64, 'base64')

    if (sigBuffer.byteLength <= 100 || sigBuffer.byteLength > 200_000) {
      return NextResponse.json(
        { error: 'invalid_signature_image', detail: 'size out of range' },
        { status: 400 }
      )
    }

    for (let i = 0; i < 8; i++) {
      if (sigBuffer[i] !== PNG_MAGIC[i]) {
        return NextResponse.json(
          { error: 'invalid_signature_image', detail: 'not a png' },
          { status: 400 }
        )
      }
    }

    // ── Step G — Upload signature to storage ──────────────────────────────
    const storagePath = `restaurants/${restaurantId}/contract_signature_v1.0.png`
    const { error: uploadErr } = await admin.storage
      .from('contracts')
      .upload(storagePath, sigBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[contract] signature upload failed:', uploadErr)
      return NextResponse.json(
        { error: 'signature_upload_failed', detail: uploadErr.message },
        { status: 500 }
      )
    }

    // ── Step H — Insert contracts row ─────────────────────────────────────
    let alreadySigned = false
    const signedAt = new Date().toISOString()

    // The migration 014 columns (locale_signed, document_hash, authority_confirmed)
    // are not yet reflected in the generated types — cast via any.
    const contractPayload = {
      restaurant_id: restaurantId,
      version: '1.0',
      signed_at: signedAt,
      signed_name: body.full_name,
      signed_ip: signedIp,
      signed_user_agent: signedUserAgent,
      signature_image_path: storagePath,
      locale_signed: body.locale_signed,
      document_hash: body.document_hash,
      authority_confirmed: true,
      terms_version_accepted: CURRENT_TERMS_VERSION,
      dpa_version_accepted: CURRENT_DPA_VERSION,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await admin.from('contracts').insert(contractPayload as any)

    if (insertErr) {
      // 23505 = unique_violation
      if (
        insertErr.code === '23505' ||
        insertErr.message?.includes('duplicate key')
      ) {
        alreadySigned = true
      } else {
        console.error('[contract] insert failed:', insertErr)
        return NextResponse.json(
          { error: 'insert_failed', detail: insertErr.message },
          { status: 500 }
        )
      }
    }

    // ── Step I — Advance onboarding step ──────────────────────────────────
    if (!alreadySigned) {
      await admin
        .from('restaurants')
        .update({ current_onboarding_step: 14, updated_at: new Date().toISOString() })
        .eq('id', restaurantId)
        .lt('current_onboarding_step', 14)
      invalidateOnboardingLayout()
    }

    // ── Step J — Audit log ────────────────────────────────────────────────
    try {
      await admin.from('audit_logs').insert({
        restaurant_id: restaurantId,
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        event_type: 'contract.signed',
        event_data: {
          restaurant_id: restaurantId,
          contract_version: '1.0',
          locale_signed: body.locale_signed,
          signed_ip: signedIp,
          signed_user_agent: signedUserAgent,
          document_hash: body.document_hash,
          signed_name: body.full_name,
          already_signed: alreadySigned,
        },
      })
    } catch (auditErr) {
      console.error('[contract] audit log failed:', auditErr)
    }

    // ── Step K — Send email ────────────────────────────────────────────────
    if (!alreadySigned) {
      try {
        const emailPromise = sendContractSignedEmail({
          to: user.email ?? '',
          restaurantLegalName: restaurant.legal_name ?? restaurantId,
          contractMarkdown: rendered.markdown,
          signedName: body.full_name,
          signedAt,
          signedIp,
          signedUserAgent,
          documentHash: body.document_hash,
          signatureImageBase64: b64,
          locale: body.locale_signed,
          contractVersion: CURRENT_CONTRACT_VERSION,
          termsVersion: CURRENT_TERMS_VERSION,
          dpaVersion: CURRENT_DPA_VERSION,
        })

        await Promise.race([
          emailPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('email_timeout')), 10_000)
          ),
        ])
      } catch (emailErr) {
        console.error('[contract] email failed:', emailErr)
        try {
          await admin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            actor_user_id: user.id,
            actor_email: user.email ?? null,
            event_type: 'contract.email_failed',
            event_data: {
              restaurant_id: restaurantId,
              error: String(emailErr),
            },
          })
        } catch {
          // best-effort
        }
      }
    }

    // ── Step L — Return ────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      already_signed: alreadySigned,
      next_step: 14,
    })
  } catch (err) {
    console.error('[/api/v1/restaurants/[id]/contract] unhandled error:', err)
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 }
    )
  }
}
