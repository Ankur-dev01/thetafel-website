import { NextResponse, type NextRequest } from 'next/server'
import { zipSync } from 'fflate'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-')
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
  }

  const { data: tables, error: tablesErr } = await supabase
    .from('restaurant_tables')
    .select('id, label, qr_image_path')
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)
    .not('qr_image_path', 'is', null)

  if (tablesErr) {
    return NextResponse.json({ error: 'tables_fetch_failed' }, { status: 500 })
  }

  const validTables = (tables ?? []).filter((t) => !!t.qr_image_path)
  if (validTables.length === 0) {
    return NextResponse.json({ error: 'no_qr_codes' }, { status: 404 })
  }

  const admin = await createSupabaseServerClientAdmin()

  // Download all PNGs in parallel
  const pngFiles: Record<string, Uint8Array> = {}
  await Promise.all(
    validTables.map(async (table) => {
      try {
        const { data: blob, error: dlErr } = await admin.storage
          .from('qr-codes')
          .download(table.qr_image_path!)
        if (dlErr || !blob) return
        const buffer = new Uint8Array(await blob.arrayBuffer())
        pngFiles[`qr-codes/${sanitizeFilename(table.label)}.png`] = buffer
      } catch {
        // Skip failed downloads — partial ZIP is better than no ZIP
      }
    })
  )

  if (Object.keys(pngFiles).length === 0) {
    return NextResponse.json({ error: 'no_qr_codes' }, { status: 404 })
  }

  const slugOrId =
    typeof restaurant.slug === 'string' && restaurant.slug
      ? restaurant.slug
      : restaurant.id.slice(0, 8)
  const filename = `qr-codes-${slugOrId}-${todayString()}.zip`

  const zipBuffer = zipSync(pngFiles, { level: 6 })

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
