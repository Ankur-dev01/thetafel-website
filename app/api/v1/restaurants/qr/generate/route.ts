import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import { renderQrPng } from '@/lib/qr/render'
import { assertOnboardingMutationForUser } from '@/lib/onboarding/guards'

const QR_BASE_URL =
  process.env.QR_BASE_URL ||
  (() => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('QR_BASE_URL not set — falling back to https://thetafel.nl')
    }
    return 'https://thetafel.nl'
  })()

const generateBodySchema = z
  .object({
    table_ids: z.array(z.string().uuid()).optional(),
    regenerate: z.boolean().optional().default(false),
  })
  .strict()

function makeToken(): string {
  return randomBytes(16).toString('base64url').slice(0, 22)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = generateBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { table_ids: requestedTableIds, regenerate } = parsed.data

  const supabase = await createSupabaseServerClient()
  const guard = await assertOnboardingMutationForUser(supabase)
  if (!guard.ok) return guard.response
  const { restaurant } = guard

  const accentColor =
    typeof restaurant.qr_widget_accent_color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(restaurant.qr_widget_accent_color)
      ? restaurant.qr_widget_accent_color
      : '#d4820a'

  // Load target tables
  let tablesQuery = supabase
    .from('restaurant_tables')
    .select('id, label, seats, is_qr_enabled, qr_token, qr_image_path, deleted_at')
    .eq('restaurant_id', restaurant.id)
    .is('deleted_at', null)

  if (requestedTableIds && requestedTableIds.length > 0) {
    tablesQuery = tablesQuery.in('id', requestedTableIds)
  } else {
    tablesQuery = tablesQuery.eq('is_qr_enabled', true)
  }

  const { data: allTables, error: tablesErr } = await tablesQuery
  if (tablesErr) {
    return NextResponse.json({ error: 'tables_fetch_failed' }, { status: 500 })
  }

  // Filter by regenerate flag
  const targetTables = (allTables ?? []).filter((t) => {
    if (regenerate) return true
    return !t.qr_token
  })

  const admin = await createSupabaseServerClientAdmin()

  const updatedTables: { id: string; label: string; qr_token: string; qr_image_path: string }[] = []
  const failures: { table_id: string; message: string }[] = []
  let skippedCount = (allTables?.length ?? 0) - targetTables.length

  for (const table of targetTables) {
    try {
      const token = makeToken()
      const qrUrl = `${QR_BASE_URL}/q/${token}`
      const pngBuffer = await renderQrPng(qrUrl, {
        accentColor,
        label: `Tafel ${table.label}`,
      })

      const storagePath = `${restaurant.id}/${table.id}.png`

      const { error: uploadErr } = await admin.storage
        .from('qr-codes')
        .upload(storagePath, pngBuffer, {
          contentType: 'image/png',
          cacheControl: '0',
          upsert: true,
        })

      if (uploadErr) {
        failures.push({ table_id: table.id, message: uploadErr.message })
        continue
      }

      const { data: updatedRow, error: updateErr } = await supabase
        .from('restaurant_tables')
        .update({ qr_token: token, qr_image_path: storagePath })
        .eq('id', table.id)
        .select('id, label, qr_token, qr_image_path')
        .single()

      if (updateErr || !updatedRow) {
        failures.push({ table_id: table.id, message: updateErr?.message ?? 'update_failed' })
        continue
      }

      updatedTables.push({
        id: updatedRow.id,
        label: updatedRow.label,
        qr_token: updatedRow.qr_token!,
        qr_image_path: updatedRow.qr_image_path!,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown_error'
      failures.push({ table_id: table.id, message: msg })
      if (process.env.NODE_ENV !== 'production') {
        console.error(`QR generation failed for table ${table.id}:`, msg)
      }
    }
  }

  // Mark qr_codes_generated_at on the restaurant if any succeeded
  if (updatedTables.length > 0) {
    await supabase
      .from('restaurants')
      .update({ qr_codes_generated_at: new Date().toISOString() })
      .eq('id', restaurant.id)
  }

  return NextResponse.json(
    {
      updated_tables: updatedTables,
      generated_count: updatedTables.length,
      skipped_count: skippedCount,
      failures,
    },
    { status: 200 }
  )
}
