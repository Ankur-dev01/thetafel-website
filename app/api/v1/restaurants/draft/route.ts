// app/api/v1/restaurants/draft/route.ts
//
// PUT endpoint hit by the C.1 saveDraft() helper on every onboarding-form
// field blur. Persists one field at a time to the authenticated user's
// restaurant draft.
//
// Per Phase 1 PRD §C.1 ("Auto-save on every field blur"):
//   - The client does NOT pass a restaurantId. The server resolves the
//     restaurant row from the session (user_id = auth.uid()).
//   - If no row exists yet, this route CREATES one with status='draft'
//     and minimum-required NOT NULL placeholders for `name` and `slug`
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
// Request:  PUT  application/json   { field: string, value: unknown }
// Response: 200  { ok: true, restaurant: { ...row subset... } }
//           400  invalid field name / invalid value
//           401  not authenticated
//           409  KVK number already taken by another account
//           500  unexpected
//
// Auth: required. Uses the standard SSR-aware Supabase client (NOT the
// service-role admin client) so RLS policies are enforced automatically.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---- Field whitelist (Phase C.2 — Step 1 only) ---------------------------
//
// Each entry maps the PUBLIC field name (what the client sends) to the
// validator that returns either a normalised value or a string error.
//
// Adding a new field for Step 2/3/etc requires extending this whitelist
// here AND the matching saveDraft() call site in the step page.

type FieldValidator = (raw: unknown) => { ok: true; value: string | null } | { ok: false; error: string }

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

function makeTextValidator(maxLen: number, allowEmpty: boolean): FieldValidator {
  return (raw: unknown) => {
    if (raw === null || raw === undefined) {
      // Treat null/undefined as clearing the field.
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
  // KVK identity (Step 1) — populated from KVK Basisprofiel autofill.
  kvk_number: validateKvkNumber,
  legal_name: makeTextValidator(200, true),
  display_name: makeTextValidator(120, false),
  legal_form: makeTextValidator(100, true),
  sbi_code: makeTextValidator(20, true),

  // Legal address (from KVK).
  legal_address_street: makeTextValidator(120, true),
  legal_address_house_number: makeTextValidator(20, true),
  legal_address_house_letter: makeTextValidator(10, true),
  legal_address_house_number_addition: makeTextValidator(20, true),
  legal_address_postcode: validatePostcode,
  legal_address_city: makeTextValidator(100, true),

  // Optional website (PRD scoping rule: use the existing `website` column,
  // do NOT introduce `website_url`).
  website: makeTextValidator(500, true),
}

// ---- Helpers --------------------------------------------------------------

function randomSlug(): string {
  // Temporary slug placeholder — replaced by the real human-readable slug
  // when the restaurant is published in C.7. Just needs to satisfy the
  // NOT NULL UNIQUE constraint.
  return `draft-${crypto.randomUUID()}`
}

function nameFromEmail(email: string | null | undefined): string {
  if (!email) return 'Mijn restaurant'
  const localPart = email.split('@')[0] ?? ''
  if (localPart.length === 0) return 'Mijn restaurant'
  // Capitalise the first letter; cap to 80 chars to be safe.
  const trimmed = localPart.slice(0, 80)
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

// ---- Route handler --------------------------------------------------------

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

    // 4. If no row yet, only allow kvk_number to create it. Every other
    //    field assumes the row already exists.
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
        // Most likely cause: another user already owns this KVK number.
        // Postgres error code 23505 = unique_violation.
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
