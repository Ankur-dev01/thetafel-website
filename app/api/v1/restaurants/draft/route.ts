// app/api/v1/restaurants/draft/route.ts
//
// PUT endpoint hit by the C.1 saveDraft() helper on every onboarding-form
// field blur, AND a GET endpoint hit by every step page on mount to
// pre-fill its inputs from existing draft data.
//
// Per Phase 1 PRD §C.1 ("Auto-save on every field blur"):
//   - The client does NOT pass a restaurantId. The server resolves the
//     restaurant row from the session (user_id = auth.uid()).
//   - If no row exists yet, PUT creates one with status='draft' and
//     minimum-required NOT NULL placeholders for `name` and `slug`
//     (regenerated properly during the Publish step in C.7).
//   - Field name is validated against a server-side whitelist — clients
//     can never write to status, slug, listing_rank, mollie_*, etc.
//
// Special case for kvk_number:
//   - kvk_number is the FIRST field every onboarding user fills in.
//   - It is the ONLY field that triggers row creation. All other fields
//     assume the row already exists.
//   - If a different user already owns a row with this kvk_number,
//     return 409 (the DB's UNIQUE constraint enforces this; we surface
//     it cleanly).
//
// Requests:
//   GET                                      → 200 { restaurant: {...} | null }
//   PUT  application/json   { field, value } → 200 { ok: true, restaurant: {...} }
//                                              400 / 401 / 409 / 500 on error
//
// Auth: required on both verbs. Uses the standard SSR-aware Supabase
// client (NOT the service-role admin client) so RLS policies are
// enforced automatically.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---- Field whitelist ----------------------------------------------------
//
// Each entry maps the PUBLIC field name (what the client sends) to the
// validator that returns either a normalised value or a string error.

type FieldValidator = (raw: unknown) =>
  | { ok: true; value: string | null }
  | { ok: false; error: string }

function validateKvkNumber(raw: unknown): ReturnType<FieldValidator> {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'kvk_number must be a string.' }
  }
  const trimmed = raw.trim()
  if (!/^\d{8}$/.test(trimmed)) {
    return { ok: false, error: 'kvk_number must be exactly 8 digits.' }
  }
  return { ok: true, value: trimmed }
}

function makeTextValidator(
  maxLen: number,
  allowEmpty: boolean
): FieldValidator {
  return (raw: unknown) => {
    if (raw === null || raw === undefined) {
      return { ok: true, value: null }
    }
    if (typeof raw !== 'string') {
      return { ok: false, error: 'Value must be a string.' }
    }
    const trimmed = raw.trim()
    if (!allowEmpty && trimmed.length === 0) {
      return { ok: false, error: 'Value cannot be empty.' }
    }
    if (trimmed.length > maxLen) {
      return { ok: false, error: `Value cannot exceed ${maxLen} characters.` }
    }
    return { ok: true, value: trimmed.length === 0 ? null : trimmed }
  }
}

// Dutch postcode: 1234 AB (with or without space). Stored normalised
// without the internal space.
function validatePostcode(raw: unknown): ReturnType<FieldValidator> {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Postcode must be a string.' }
  }
  const stripped = raw.trim().replace(/\s+/g, '').toUpperCase()
  if (stripped.length === 0) return { ok: true, value: null }
  if (!/^\d{4}[A-Z]{2}$/.test(stripped)) {
    return { ok: false, error: 'Postcode must match 1234 AB format.' }
  }
  return { ok: true, value: stripped }
}

const FIELD_WHITELIST: Record<string, FieldValidator> = {
  // ---- KVK identity (Step 1) ----
  kvk_number: validateKvkNumber,
  legal_name: makeTextValidator(200, true),
  display_name: makeTextValidator(120, false),
  legal_form: makeTextValidator(100, true),
  sbi_code: makeTextValidator(20, true),

  // ---- Legal address from KVK (Step 1) ----
  legal_address_street: makeTextValidator(120, true),
  legal_address_house_number: makeTextValidator(20, true),
  legal_address_house_letter: makeTextValidator(10, true),
  legal_address_house_number_addition: makeTextValidator(20, true),
  legal_address_postcode: validatePostcode,
  legal_address_city: makeTextValidator(100, true),

  // ---- Optional website (Step 1) ----
  // Uses the existing `website` column per PRD scoping rule.
  website: makeTextValidator(500, true),

  // ---- Dining venue address (Step 2) ----
  // Single `address` column holds "street + house number" combined
  // (existing schema from Phase A/B; the PRD's userflow Stage 4 names
  // them straat + huisnummer separately, but the column model is one
  // text field).
  address: makeTextValidator(200, true),
  postcode: validatePostcode,
  city: makeTextValidator(100, true),

  // ---- Cuisine & vibe (Step 3) ----
  // cuisine_type is a single choice from a fixed list rendered in the
  // Step 3 page; we store it as plain text. description is the short
  // free-text "vibe" paragraph. hero_image_url is NOT whitelisted here
  // because it is written directly by /api/v1/restaurants/photo, never
  // by the client.
  cuisine_type: makeTextValidator(60, true),
  description: makeTextValidator(600, true),
}

// ---- Columns returned by GET ---------------------------------------------
//
// Explicit list rather than SELECT *. When new columns are added later
// (Mollie, billing, etc.) they don't accidentally leak out of this
// endpoint, and the response shape stays stable for the client.

const DRAFT_SELECT_COLUMNS = [
  'id',
  'status',
  'name',
  'slug',
  // KVK identity (Step 1)
  'kvk_number',
  'legal_name',
  'display_name',
  'legal_form',
  'sbi_code',
  'website',
  // Legal address from KVK (Step 1)
  'legal_address_street',
  'legal_address_house_number',
  'legal_address_house_letter',
  'legal_address_house_number_addition',
  'legal_address_postcode',
  'legal_address_city',
  // Dining venue address (Step 2)
  'address',
  'postcode',
  'city',
  // Step 3 — cuisine, photo, vibe
  'cuisine_type',
  'description',
  'hero_image_url',
  // Step 4-5 — operations
  'max_party_size',
  'booking_lead_days',
  'min_notice_hours',
  'slot_interval_minutes',
  // Step 6 — contact
  'contact_phone',
  'email',
].join(', ')

// ---- Helpers --------------------------------------------------------------

function randomSlug(): string {
  return `draft-${crypto.randomUUID()}`
}

function nameFromEmail(email: string | null | undefined): string {
  if (!email) return 'Mijn restaurant'
  const localPart = email.split('@')[0] ?? ''
  if (localPart.length === 0) return 'Mijn restaurant'
  const trimmed = localPart.slice(0, 80)
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

// ---- GET handler ---------------------------------------------------------
//
// Returns the authenticated user's draft restaurant row, or
// { restaurant: null } if none exists yet.

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { restaurant: null, error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    const { data: restaurant, error: lookupError } = await supabase
      .from('restaurants')
      .select(DRAFT_SELECT_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) {
      console.error('draft GET lookup error:', lookupError)
      return NextResponse.json(
        { restaurant: null, error: 'Could not load draft.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ restaurant: restaurant ?? null }, { status: 200 })
  } catch (err) {
    console.error('draft GET unexpected error:', err)
    return NextResponse.json(
      { restaurant: null, error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}

// ---- PUT handler ---------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    // 2. Body
    let body: { field?: unknown; value?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body.' },
        { status: 400 }
      )
    }

    const field =
      typeof body.field === 'string' ? body.field.trim() : ''
    if (!field) {
      return NextResponse.json(
        { ok: false, error: 'Missing field name.' },
        { status: 400 }
      )
    }

    const validator = FIELD_WHITELIST[field]
    if (!validator) {
      return NextResponse.json(
        { ok: false, error: `Field "${field}" cannot be written.` },
        { status: 400 }
      )
    }

    const validated = validator(body.value)
    if (!validated.ok) {
      return NextResponse.json(
        { ok: false, error: validated.error },
        { status: 400 }
      )
    }

    // 3. Look up the existing restaurant row for this user.
    const { data: existing, error: lookupError } = await supabase
      .from('restaurants')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) {
      console.error('draft route lookup error:', lookupError)
      return NextResponse.json(
        { ok: false, error: 'Could not load draft.' },
        { status: 500 }
      )
    }

    // 4. If no row yet, only allow kvk_number to create it.
    if (!existing) {
      if (field !== 'kvk_number') {
        return NextResponse.json(
          {
            ok: false,
            error:
              'KVK number must be entered first before other fields can be saved.',
          },
          { status: 400 }
        )
      }

      const insertPayload = {
        user_id: user.id,
        name: nameFromEmail(user.email),
        slug: randomSlug(),
        status: 'draft' as const,
        [field]: validated.value,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('restaurants')
        .insert(insertPayload)
        .select('id, status, kvk_number')
        .single()

      if (insertError) {
        const code = (insertError as { code?: string }).code
        if (code === '23505') {
          return NextResponse.json(
            {
              ok: false,
              error:
                'This KVK number is already linked to another account.',
            },
            { status: 409 }
          )
        }
        console.error('draft route insert error:', insertError)
        return NextResponse.json(
          { ok: false, error: 'Could not save draft.' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { ok: true, restaurant: inserted },
        { status: 200 }
      )
    }

    // 5. Row exists — UPDATE the single field.
    const updatePayload = { [field]: validated.value }

    const { data: updated, error: updateError } = await supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('user_id', user.id)
      .select('id, status, kvk_number')
      .single()

    if (updateError) {
      const code = (updateError as { code?: string }).code
      if (code === '23505') {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This KVK number is already linked to another account.',
          },
          { status: 409 }
        )
      }
      console.error('draft route update error:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Could not save draft.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { ok: true, restaurant: updated },
      { status: 200 }
    )
  } catch (err) {
    console.error('draft route unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
