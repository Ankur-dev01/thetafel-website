// app/api/v1/public/orders/[token]/status/route.ts
//
// GET /api/v1/public/orders/{token}/status
//
// Lean polling endpoint. Called every 8s / 30s per POLL_PHASES.
// Returns only { status, orderRef, updatedAt } — no items, no PII, no audit,
// no magic_links.consume_count bump. A guest polls ~130 times over a
// session; consumeOrderMagicLink's audit + RPC overhead is deliberately
// bypassed here — that path is only used once, on page load.
//
// Rate limit uses a dedicated order_status_poll key (30/min per IP) — plenty
// for the fast-phase cadence (~7.5 req/min) with headroom for a page refresh
// or two, while still catching a runaway/abusive client quickly.

import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'node:crypto'
import { checkConsumerRateLimit, getCallerIp } from '@/lib/consumer/rateLimit'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 404 })
  }

  const ip = getCallerIp(req)
  const rl = await checkConsumerRateLimit('order_status_poll', ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 60) } },
    )
  }

  const admin = await createSupabaseServerClientAdmin()
  const tokenHash = hashToken(token)

  const { data: link, error: linkErr } = await admin
    .from('magic_links')
    .select('order_id, expires_at, purpose')
    .eq('token_hash', tokenHash)
    .eq('purpose', 'view_order')
    .maybeSingle()

  if (linkErr) {
    console.error('[order/status] magic_links lookup failed', linkErr.message)
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 })
  }
  if (!link || !link.order_id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 410 })
  }

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('status, order_ref, updated_at')
    .eq('id', link.order_id)
    .maybeSingle()

  if (orderErr) {
    console.error('[order/status] orders lookup failed', orderErr.message)
    return NextResponse.json({ ok: false, error: 'lookup_failed' }, { status: 500 })
  }
  if (!order) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      ok: true,
      status: order.status,
      orderRef: order.order_ref,
      updatedAt: order.updated_at,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
