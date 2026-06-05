import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const patchBodySchema = z
  .object({
    is_qr_enabled: z.boolean().optional(),
  })
  .strict()

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = patchBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS scopes the fetch to the user's own restaurant tables.
  const { data: tableRow, error: fetchErr } = await supabase
    .from('restaurant_tables')
    .select('id, restaurant_id, is_qr_enabled, qr_token, qr_image_path, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !tableRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('restaurant_tables')
    .update(parsed.data)
    .eq('id', id)
    .select('*')
    .single()

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: 'update_failed', message: updateErr?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ table: updated }, { status: 200 })
}
