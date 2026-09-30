// GET /api/dashboard/billing/receipt/{paymentId}?locale=nl|en
// Owner-only PDF receipt for one PAID payment of the caller's own restaurant.

import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import {
  PAYMENT_COLUMNS,
  isVerificationCharge,
  splitGross,
  type PaymentRow,
} from '@/lib/dashboard/billing/billing'
import { receiptReference, renderReceiptPdf } from '@/lib/dashboard/billing/receiptPdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, ctx: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await ctx.params
  if (!UUID.test(paymentId)) return new NextResponse('Not found', { status: 404 })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, legal_name, display_name, kvk_number, btw_number')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!restaurant) return new NextResponse('Not found', { status: 404 })

  // Billing is owner-only; 'settings.billing.cancel' is owner-only in the map.
  const guard = await assertDashboardWriteAllowed(restaurant.id, 'settings.billing.cancel', user)
  if (!guard.ok) return new NextResponse('Forbidden', { status: guard.httpStatus })

  const admin = await createSupabaseServerClientAdmin()
  const { data: payment } = await admin
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('id', paymentId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle<PaymentRow>()

  if (!payment || payment.status !== 'paid' || !payment.paid_at || isVerificationCharge(payment)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const locale: 'nl' | 'en' = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'nl'
  const vatRateBps = payment.vat_rate_bps ?? 2100
  const amounts = splitGross(payment.amount_cents, vatRateBps)

  const pdf = await renderReceiptPdf({
    locale,
    paymentId: payment.id,
    paidAt: payment.paid_at,
    description: payment.description ?? '—',
    currency: payment.currency,
    grossCents: amounts.gross,
    netCents: amounts.net,
    vatCents: amounts.vat,
    vatRateBps,
    restaurant: {
      legalName: restaurant.legal_name ?? restaurant.display_name ?? '—',
      kvk: restaurant.kvk_number ?? null,
      btw: restaurant.btw_number ?? null,
    },
  })

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receiptReference(payment.id)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
