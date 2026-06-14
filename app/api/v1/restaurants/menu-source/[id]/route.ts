import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertOnboardingMutationForUser } from '@/lib/onboarding/guards'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const guard = await assertOnboardingMutationForUser(supabase)
  if (!guard.ok) return guard.response

  // Fetch the row — RLS ensures only the owner sees it.
  const { data: row, error: fetchErr } = await supabase
    .from('menu_source_uploads')
    .select('id, storage_path, restaurant_id, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Soft-delete the row first.
  const { error: updateErr } = await supabase
    .from('menu_source_uploads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json(
      { error: 'soft_delete_failed', message: updateErr.message },
      { status: 500 }
    )
  }

  // Remove the storage file. Failure here is logged but does NOT roll back the row
  // delete — the row is gone, the file will be cleaned up by a future GC job.
  const { error: storageErr } = await supabase.storage
    .from('restaurant-menu-sources')
    .remove([row.storage_path])

  if (storageErr && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('menu-source storage remove failed:', storageErr.message)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
