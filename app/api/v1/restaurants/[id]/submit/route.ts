import { NextRequest, NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import { sendRestaurantSubmittedEmail } from '@/lib/email/restaurant-submitted'

export const runtime = 'nodejs'

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

    // ── Step B — Load restaurant ───────────────────────────────────────────
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .select(
        `id, user_id, status, current_onboarding_step,
         legal_name, contact_email, subscription_tier,
         service_reservations_enabled, service_takeaway_enabled,
         service_qr_enabled, qr_plan, submitted_at`
      )
      .eq('id', restaurantId)
      .maybeSingle()

    if (restErr || !restaurant) {
      return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
    }

    if (restaurant.user_id !== user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ── Step C — Idempotency: already submitted ────────────────────────────
    if (
      restaurant.status === 'pending_review' ||
      restaurant.status === 'live'
    ) {
      return NextResponse.json({ ok: true, already_submitted: true })
    }

    // ── Step D — Guard: must be at step 14 with signed contract ────────────
    if ((restaurant.current_onboarding_step ?? 0) < 14) {
      return NextResponse.json(
        { error: 'onboarding_incomplete', detail: 'Must be at step 14' },
        { status: 422 }
      )
    }

    const { data: contractRow } = await supabase
      .from('contracts')
      .select('id, signed_at')
      .eq('restaurant_id', restaurantId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!contractRow?.signed_at) {
      return NextResponse.json(
        { error: 'contract_not_signed' },
        { status: 422 }
      )
    }

    // ── Step E — Read IP and user agent (for audit) ────────────────────────
    const headers = req.headers
    const submittedIp =
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      '0.0.0.0'
    const submittedUserAgent = (headers.get('user-agent') ?? '').slice(0, 500)

    // ── Step F — Switch to admin client ────────────────────────────────────
    const admin = await createSupabaseServerClientAdmin()
    const submittedAt = new Date().toISOString()

    // ── Step G — Update restaurant: status + submitted_at ──────────────────
    const { error: updateErr } = await admin
      .from('restaurants')
      .update({
        status: 'pending_review',
        submitted_at: submittedAt,
        updated_at: submittedAt,
      })
      .eq('id', restaurantId)
      .eq('status', 'onboarding')

    if (updateErr) {
      console.error('[submit] restaurants update failed:', updateErr)
      return NextResponse.json(
        { error: 'update_failed', detail: updateErr.message },
        { status: 500 }
      )
    }

    // ── Step H — Create review_tasks row (idempotent under retries) ────────
    const { data: existingTask } = await admin
      .from('review_tasks')
      .select('id, status')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending'])
      .limit(1)
      .maybeSingle()

    if (!existingTask) {
      const { error: taskErr } = await admin.from('review_tasks').insert({
        restaurant_id: restaurantId,
        status: 'pending',
        notes: null,
      })
      if (taskErr) {
        console.error('[submit] review_tasks insert failed:', taskErr)
        // Don't fail the request — the status flip is the source of truth.
      }
    }

    // ── Step I — Audit log (best-effort) ───────────────────────────────────
    try {
      await admin.from('audit_logs').insert({
        restaurant_id: restaurantId,
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        event_type: 'restaurant.submitted',
        event_data: {
          restaurant_id: restaurantId,
          submitted_at: submittedAt,
          previous_status: restaurant.status,
        },
        ip_address: submittedIp,
        user_agent: submittedUserAgent,
      })
    } catch (auditErr) {
      console.error('[submit] audit log failed:', auditErr)
    }

    // ── Step J — Admin notification email (best-effort) ────────────────────
    try {
      const emailPromise = sendRestaurantSubmittedEmail({
        legalName: restaurant.legal_name ?? restaurantId,
        restaurantId,
        contactEmail: restaurant.contact_email ?? user.email ?? null,
        subscriptionTier: restaurant.subscription_tier ?? null,
        servicesEnabled: {
          reservations: !!restaurant.service_reservations_enabled,
          takeaway: !!restaurant.service_takeaway_enabled,
          qr: !!restaurant.service_qr_enabled,
        },
        qrPlan: restaurant.qr_plan ?? null,
        submittedAt,
      })
      await Promise.race([
        emailPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('email_timeout')), 10_000)
        ),
      ])
    } catch (emailErr) {
      console.error('[submit] admin email failed:', emailErr)
      try {
        await admin.from('audit_logs').insert({
          restaurant_id: restaurantId,
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          event_type: 'restaurant.submitted_email_failed',
          event_data: {
            restaurant_id: restaurantId,
            error: String(emailErr),
          },
        })
      } catch {
        // best-effort only
      }
    }

    // ── Step K — Return ────────────────────────────────────────────────────
    return NextResponse.json({
      ok: true,
      already_submitted: false,
      submitted_at: submittedAt,
    })
  } catch (err) {
    console.error('[/api/v1/restaurants/[id]/submit] unhandled error:', err)
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 }
    )
  }
}
