import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
  }

  const { data: payment } = await supabase
    .from('payments')
    .select('id, restaurant_id, status, kind')
    .eq('id', id)
    .maybeSingle()

  if (!payment || payment.restaurant_id !== restaurant.id) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
  }

  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    kind: payment.kind,
  })
}
