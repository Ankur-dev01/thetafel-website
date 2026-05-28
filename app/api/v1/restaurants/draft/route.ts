/**
 * /api/v1/restaurants/draft
 *
 * GET   → returns the current user's onboarding draft, including
 *         zones, tables, availability, and menu_uploads. Auto-creates
 *         the restaurants row on first call.
 *
 * PATCH → partial update. Body may include any subset of:
 *           { restaurant, zones, tables, availability, menu_uploads }
 *         Sub-resource arrays are replace-all semantics. Restaurant
 *         fields are merged column by column.
 *
 * Security:
 *   - All DB reads/writes use the user's Supabase client; RLS scopes
 *     everything to the user's own restaurant row automatically.
 *   - audit_logs writes use the admin client (service role) because
 *     audit_logs has no INSERT policy for regular users.
 *
 * Rate limit:
 *   - 30 PATCH requests per minute per user (Upstash).
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'
import {
  draftPatchBodySchema,
  type DraftPatchBody,
} from '@/lib/onboarding/draftSchema'

// ---- Types ------------------------------------------------------------------

type SupabaseUserClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

// ---- Rate limiter (lazy singleton) -----------------------------------------

let _ratelimit: Ratelimit | null = null
function getRateLimiter(): Ratelimit {
  if (_ratelimit) return _ratelimit
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  _ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'draft_patch',
    analytics: false,
  })
  return _ratelimit
}

// ---- Helpers ----------------------------------------------------------------

function generateSlugFromUserId(userId: string): string {
  return `draft-${userId.replace(/-/g, '').slice(0, 16)}`
}

async function getOrCreateDraftRestaurant(
  supabase: SupabaseUserClient,
  userId: string
) {
  const { data: existing, error: findErr } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (findErr) throw findErr
  if (existing) return existing

  const slug = generateSlugFromUserId(userId)
  const { data: created, error: insertErr } = await supabase
    .from('restaurants')
    .insert({
      user_id: userId,
      slug,
      name: 'Mijn restaurant',
      status: 'onboarding',
    })
    .select('*')
    .single()

  if (insertErr) throw insertErr
  return created
}

async function logAudit(opts: {
  userId: string
  userEmail: string | null
  restaurantId: string
  eventType: string
  eventData: Record<string, unknown>
  ip: string | null
  userAgent: string | null
}) {
  try {
    const admin = await createSupabaseServerClientAdmin()
    await admin.from('audit_logs').insert({
      actor_user_id: opts.userId,
      actor_email: opts.userEmail,
      restaurant_id: opts.restaurantId,
      event_type: opts.eventType,
      event_data: opts.eventData,
      ip_address: opts.ip,
      user_agent: opts.userAgent,
    })
  } catch {
    // Audit failure must never break the user-visible request.
  }
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

// ---- GET --------------------------------------------------------------------

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const restaurant = await getOrCreateDraftRestaurant(supabase, user.id)

    const [zonesRes, tablesRes, availabilityRes, uploadsRes] =
      await Promise.all([
        supabase
          .from('zones')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null)
          .order('display_order', { ascending: true }),
        supabase
          .from('restaurant_tables')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null)
          .order('label', { ascending: true }),
        supabase
          .from('availability')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .order('day_of_week', { ascending: true })
          .order('service_scope', { ascending: true }),
        supabase
          .from('menu_source_uploads')
          .select('*')
          .eq('restaurant_id', restaurant.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }),
      ])

    return NextResponse.json({
      restaurant,
      zones: zonesRes.data ?? [],
      tables: tablesRes.data ?? [],
      availability: availabilityRes.data ?? [],
      menu_uploads: uploadsRes.data ?? [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    return NextResponse.json(
      { error: 'load_failed', message },
      { status: 500 }
    )
  }
}

// ---- PATCH ------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Rate limit by user id.
  try {
    const rl = getRateLimiter()
    const { success } = await rl.limit(user.id)
    if (!success) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_seconds: 60 },
        { status: 429 }
      )
    }
  } catch {
    // If Redis is down, fail open rather than block autosave.
  }

  // Parse + validate body.
  let body: DraftPatchBody
  try {
    const raw = await req.json()
    const parsed = draftPatchBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', issues: parsed.error.issues },
        { status: 400 }
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // Empty body → no-op, return current state.
  const isEmpty =
    !body.restaurant &&
    !body.zones &&
    !body.tables &&
    !body.availability &&
    !body.menu_uploads

  try {
    const restaurant = await getOrCreateDraftRestaurant(supabase, user.id)

    if (isEmpty) {
      return NextResponse.json({ restaurant }, { status: 200 })
    }

    const restaurantId = restaurant.id as string

    // ---- 1. Restaurant fields: merge update --------------------------------
    if (body.restaurant && Object.keys(body.restaurant).length > 0) {
      const { error } = await supabase
        .from('restaurants')
        .update(body.restaurant)
        .eq('id', restaurantId)
      if (error) {
        // Postgres unique_violation (SQLSTATE 23505). The only UNIQUE constraint
        // reachable via a client PATCH is restaurants.kvk_number — surface as 409
        // so the client can show "already linked to another account". If a future
        // step allows clients to set `slug`, this handler would need to disambiguate
        // by constraint name (error.details) rather than using a generic message.
        if ((error as { code?: string }).code === '23505') {
          return NextResponse.json(
            { error: 'kvk_already_linked', message: error.message },
            { status: 409 }
          )
        }
        return NextResponse.json(
          { error: 'restaurant_update_failed', message: error.message },
          { status: 400 }
        )
      }
    }

    // ---- 2. Zones: replace-all by name -------------------------------------
    if (body.zones) {
      const incomingNames = new Set(body.zones.map((z) => z.name))
      const { data: existingZones } = await supabase
        .from('zones')
        .select('id, name')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)

      const toSoftDelete = (existingZones ?? []).filter(
        (z) => !incomingNames.has(z.name)
      )
      if (toSoftDelete.length > 0) {
        const idsToDelete = toSoftDelete.map((z) => z.id)
        const { error: delErr } = await supabase
          .from('zones')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', idsToDelete)
        if (delErr) {
          return NextResponse.json(
            { error: 'zones_delete_failed', message: delErr.message },
            { status: 400 }
          )
        }
      }

      for (const z of body.zones) {
        const payload = {
          restaurant_id: restaurantId,
          name: z.name,
          display_order: z.display_order ?? 0,
          color: z.color ?? '#d4820a',
          deleted_at: null,
        }
        const { error: upErr } = await supabase
          .from('zones')
          .upsert(payload, { onConflict: 'restaurant_id,name' })
        if (upErr) {
          return NextResponse.json(
            {
              error: 'zone_upsert_failed',
              message: upErr.message,
              zone: z.name,
            },
            { status: 400 }
          )
        }
      }
    }

    // ---- 3. Tables: replace-all by label -----------------------------------
    if (body.tables) {
      const incomingLabels = new Set(body.tables.map((t) => t.label))
      const { data: existingTables } = await supabase
        .from('restaurant_tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)

      const toSoftDelete = (existingTables ?? []).filter(
        (t) => !incomingLabels.has(t.label)
      )
      if (toSoftDelete.length > 0) {
        const idsToDelete = toSoftDelete.map((t) => t.id)
        const { error: delErr } = await supabase
          .from('restaurant_tables')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', idsToDelete)
        if (delErr) {
          return NextResponse.json(
            { error: 'tables_delete_failed', message: delErr.message },
            { status: 400 }
          )
        }
      }

      for (const t of body.tables) {
        const payload = {
          restaurant_id: restaurantId,
          zone_id: t.zone_id,
          label: t.label,
          seats: t.seats,
          is_bookable: t.is_bookable ?? true,
          is_qr_enabled: t.is_qr_enabled ?? true,
          deleted_at: null,
        }
        const { error: upErr } = await supabase
          .from('restaurant_tables')
          .upsert(payload, { onConflict: 'restaurant_id,label' })
        if (upErr) {
          return NextResponse.json(
            {
              error: 'table_upsert_failed',
              message: upErr.message,
              label: t.label,
            },
            { status: 400 }
          )
        }
      }
    }

    // ---- 4. Availability: replace-all by (day, scope) ----------------------
    if (body.availability) {
      const incomingKeys = new Set(
        body.availability.map(
          (a) => `${a.day_of_week}__${a.service_scope ?? 'all'}`
        )
      )
      const { data: existingAvail } = await supabase
        .from('availability')
        .select('id, day_of_week, service_scope')
        .eq('restaurant_id', restaurantId)

      const toDelete = (existingAvail ?? []).filter(
        (a) => !incomingKeys.has(`${a.day_of_week}__${a.service_scope}`)
      )
      if (toDelete.length > 0) {
        const idsToDelete = toDelete.map((a) => a.id)
        const { error: delErr } = await supabase
          .from('availability')
          .delete()
          .in('id', idsToDelete)
        if (delErr) {
          return NextResponse.json(
            { error: 'availability_delete_failed', message: delErr.message },
            { status: 400 }
          )
        }
      }

      for (const a of body.availability) {
        const payload = {
          restaurant_id: restaurantId,
          day_of_week: a.day_of_week,
          service_scope: a.service_scope ?? 'all',
          open_time: a.open_time,
          close_time: a.close_time,
          closes_next_day: a.closes_next_day ?? false,
          is_active: a.is_active ?? true,
          tag_brunch: a.tag_brunch ?? false,
          tag_lunch: a.tag_lunch ?? false,
          tag_dinner: a.tag_dinner ?? false,
        }
        const { error: upErr } = await supabase
          .from('availability')
          .upsert(payload, {
            onConflict: 'restaurant_id,day_of_week,service_scope',
          })
        if (upErr) {
          return NextResponse.json(
            {
              error: 'availability_upsert_failed',
              message: upErr.message,
              day: a.day_of_week,
              scope: a.service_scope,
            },
            { status: 400 }
          )
        }
      }
    }

    // ---- 5. Menu uploads: append-only --------------------------------------
    if (body.menu_uploads && body.menu_uploads.length > 0) {
      const toInsert = body.menu_uploads.filter((u) => !u.id)
      if (toInsert.length > 0) {
        const payloads = toInsert.map((u) => ({
          restaurant_id: restaurantId,
          channel: u.channel ?? 'both',
          upload_type: u.upload_type ?? 'menu',
          storage_path: u.storage_path,
          original_filename: u.original_filename,
          file_size_bytes: u.file_size_bytes,
          mime_type: u.mime_type,
        }))
        const { error: insErr } = await supabase
          .from('menu_source_uploads')
          .insert(payloads)
        if (insErr) {
          return NextResponse.json(
            { error: 'menu_upload_insert_failed', message: insErr.message },
            { status: 400 }
          )
        }
      }
    }

    // ---- 6. Audit log ------------------------------------------------------
    await logAudit({
      userId: user.id,
      userEmail: user.email ?? null,
      restaurantId,
      eventType: 'draft.patch',
      eventData: {
        keys: Object.keys(body),
        restaurant_fields: body.restaurant
          ? Object.keys(body.restaurant)
          : [],
        zones_count: body.zones?.length,
        tables_count: body.tables?.length,
        availability_count: body.availability?.length,
        menu_uploads_count: body.menu_uploads?.length,
      },
      ip: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    })

    // ---- 7. Return refreshed state -----------------------------------------
    const { data: refreshed } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single()

    return NextResponse.json({ restaurant: refreshed }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'internal_error'
    return NextResponse.json(
      { error: 'patch_failed', message },
      { status: 500 }
    )
  }
}
