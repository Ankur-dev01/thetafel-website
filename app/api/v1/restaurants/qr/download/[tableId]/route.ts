import { NextResponse, type NextRequest } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'

/**
 * Sanitise a table label into a filesystem-safe filename fragment.
 * Mirrors the rule used by the download-all ZIP route so single and
 * bulk downloads produce identical names.
 */
function sanitiseLabel(label: string | null | undefined): string {
  if (!label) return 'table'
  const cleaned = label
    .normalize('NFKD')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned.length > 0 ? cleaned : 'table'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const { tableId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId)) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 })
  }

  // 1. Auth + ownership — user-scoped client
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS on restaurant_tables scopes to the owner's restaurants
  const { data: table, error: tableErr } = await supabase
    .from('restaurant_tables')
    .select('id, label, qr_image_path, deleted_at')
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle()

  if (tableErr || !table) {
    return NextResponse.json({ error: 'table_not_found' }, { status: 404 })
  }

  if (!table.qr_image_path) {
    return NextResponse.json({ error: 'qr_not_generated' }, { status: 409 })
  }

  // 2. Sign the URL — admin client, with download disposition
  const filename = `qr-${sanitiseLabel(table.label)}.png`

  const admin = await createSupabaseServerClientAdmin()
  const { data: signed, error: signErr } = await admin.storage
    .from('qr-codes')
    .createSignedUrl(table.qr_image_path, 300, { download: filename })

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign_failed' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, filename }, { status: 200 })
}
