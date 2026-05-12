// app/api/kvk/profile/route.ts
//
// Full-profile fetch for the Dutch Chamber of Commerce (KVK) Basisprofiel
// API. Called once after the user selects a business from the typeahead
// dropdown. Returns the identity fields Step 1 needs to autofill the
// onboarding form.
//
// Per Phase C kickoff prompt:
//   - All KVK calls server-side only. KVK_API_KEY is never exposed.
//   - Rate limit: 30 per IP per hour (profile fetches are intentional
//     selections, not exploratory typing).
//   - Cache results in Upstash with 24h TTL keyed by `kvk:profile:v2:${kvkNummer}`.
//
// Basisprofiel response shape (confirmed against the test environment):
//   {
//     "kvkNummer": "68750110",
//     "naam": "Test BV Donald",                         // <- legalName
//     "statutaireNaam": "Test BV Donald",               // <- fallback for legalName
//     "handelsnamen": [{"naam": "...", "volgorde": 0}], // ignored (use hoofdvestiging.eersteHandelsnaam)
//     "sbiActiviteiten": [                              // <- sbiCode lives here (top level)
//       {"sbiCode": "01241", "sbiOmschrijving": "...", "indHoofdactiviteit": "Ja"}
//     ],
//     "_embedded": {
//       "eigenaar": { "rechtsvorm": "..." },            // <- legalForm
//       "hoofdvestiging": {
//         "eersteHandelsnaam": "Test BV Donald",        // <- tradeName
//         "websiteAdres": "...",                        // <- websiteUrl (often absent in test data)
//         "adressen": [
//           { "type": "correspondentieadres", ... },    // postal — skip
//           { "type": "bezoekadres", "straatnaam": "...", "huisnummer": 3,
//             "huisletter": "A", "huisnummerToevoeging": "bis",
//             "postcode": "8823SJ", "plaats": "Lollum", ... }
//         ]
//       }
//     }
//   }
//
// Output shape (stable narrow contract for Step 1 autofill):
//   { kvkNummer, legalName, legalForm, tradeName, websiteUrl, sbiCode,
//     legalAddress: { street, houseNumber, houseLetter, houseNumberAddition,
//                     postcode, city } }
//
// POST chosen over GET because this triggers a paid upstream call.

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  analytics: false,
  prefix: 'kvk-profile',
})

const PROFILE_CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 hours
const KVK_NUMMER_REGEX = /^\d{8}$/

// ---- KVK Basisprofiel upstream types --------------------------------------
//
// Only the fields we read are modelled. Everything else from KVK is ignored.

type KvkAdres = {
  type?: string // "bezoekadres" | "correspondentieadres" | ...
  straatnaam?: string
  huisnummer?: number | string
  huisletter?: string
  huisnummerToevoeging?: string
  postcode?: string
  plaats?: string
}

type KvkSbiActiviteit = {
  sbiCode?: string
  indHoofdactiviteit?: string // "Ja" | "Nee"
}

type KvkHoofdvestiging = {
  eersteHandelsnaam?: string
  websiteAdres?: string
  adressen?: KvkAdres[]
}

type KvkEigenaar = {
  rechtsvorm?: string
}

type KvkBasisprofiel = {
  kvkNummer?: string
  naam?: string
  statutaireNaam?: string
  sbiActiviteiten?: KvkSbiActiviteit[]
  _embedded?: {
    hoofdvestiging?: KvkHoofdvestiging
    eigenaar?: KvkEigenaar
  }
}

// ---- Our narrow output shape ----------------------------------------------

type LegalAddress = {
  street: string
  houseNumber: string
  houseLetter: string
  houseNumberAddition: string
  postcode: string
  city: string
}

type ProfilePayload = {
  kvkNummer: string
  legalName: string
  legalForm: string
  tradeName: string
  websiteUrl: string
  sbiCode: string
  legalAddress: LegalAddress
}

const EMPTY_ADDRESS: LegalAddress = {
  street: '',
  houseNumber: '',
  houseLetter: '',
  houseNumberAddition: '',
  postcode: '',
  city: '',
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumberOrStringToString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function pickAddress(addresses: KvkAdres[] | undefined): LegalAddress {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return EMPTY_ADDRESS
  }
  // Prefer "bezoekadres" (visiting address — the physical location).
  // Falls back to the first address if no bezoekadres is present.
  const bezoek = addresses.find((a) => a?.type === 'bezoekadres')
  const chosen = bezoek ?? addresses[0]
  if (!chosen) return EMPTY_ADDRESS

  return {
    street: asString(chosen.straatnaam),
    houseNumber: asNumberOrStringToString(chosen.huisnummer),
    houseLetter: asString(chosen.huisletter),
    houseNumberAddition: asString(chosen.huisnummerToevoeging),
    postcode: asString(chosen.postcode),
    city: asString(chosen.plaats),
  }
}

function pickSbiCode(sbis: KvkSbiActiviteit[] | undefined): string {
  if (!Array.isArray(sbis) || sbis.length === 0) return ''
  // Prefer the entry flagged as the main activity ("indHoofdactiviteit": "Ja").
  // Falls back to the first entry otherwise.
  const main = sbis.find((s) => s?.indHoofdactiviteit === 'Ja')
  const chosen = main ?? sbis[0]
  return asString(chosen?.sbiCode)
}

function mapProfile(
  raw: KvkBasisprofiel,
  requestedKvkNummer: string
): ProfilePayload {
  const hoofd = raw._embedded?.hoofdvestiging
  const eigenaar = raw._embedded?.eigenaar

  // Legal name: top-level `naam` is the canonical record name.
  // `statutaireNaam` is the formal articles-of-association name — used
  // as a fallback for entries where `naam` is absent.
  const legalName = asString(raw.naam) || asString(raw.statutaireNaam)

  return {
    kvkNummer: asString(raw.kvkNummer) || requestedKvkNummer,
    legalName,
    legalForm: asString(eigenaar?.rechtsvorm),
    tradeName: asString(hoofd?.eersteHandelsnaam),
    websiteUrl: asString(hoofd?.websiteAdres),
    sbiCode: pickSbiCode(raw.sbiActiviteiten),
    legalAddress: pickAddress(hoofd?.adressen),
  }
}

export async function POST(request: NextRequest) {
  try {
    // ---- 1. Parse & validate body ----------------------------------------
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body.' },
        { status: 400 }
      )
    }

    const kvkNummerRaw =
      typeof body === 'object' &&
      body !== null &&
      'kvkNummer' in body &&
      typeof (body as { kvkNummer: unknown }).kvkNummer === 'string'
        ? (body as { kvkNummer: string }).kvkNummer.trim()
        : ''

    if (!KVK_NUMMER_REGEX.test(kvkNummerRaw)) {
      return NextResponse.json(
        { error: 'kvkNummer must be exactly 8 digits.' },
        { status: 400 }
      )
    }

    // ---- 2. Rate limit by IP --------------------------------------------
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1'

    const isDev = process.env.NODE_ENV === 'development'
    const { success, reset } = await ratelimit.limit(ip)

    if (!success && !isDev) {
      const retryAfter = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000)
      )
      return NextResponse.json(
        { error: 'Too many profile requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() },
        }
      )
    }

    // ---- 3. Cache lookup -------------------------------------------------
    // Versioned key (`v2`) is fresh — the bad data we cached during the
    // buggy first version of this route had no entries at v2, so we're
    // safe. Older `kvk:${kvkNummer}` style keys (if any) just expire.
    const cacheKey = `kvk:profile:v3:${kvkNummerRaw}`
    try {
      const cached = await redis.get<ProfilePayload>(cacheKey)
      if (cached && typeof cached === 'object' && cached.kvkNummer) {
        return NextResponse.json(cached, { status: 200 })
      }
    } catch (cacheErr) {
      console.warn('kvk-profile: cache read failed:', cacheErr)
    }

    // ---- 4. Upstream KVK call --------------------------------------------
    const apiKey = process.env.KVK_API_KEY
    const baseUrl = process.env.KVK_API_BASE_URL

    if (!apiKey || !baseUrl) {
      console.error(
        'kvk-profile: KVK_API_KEY or KVK_API_BASE_URL missing'
      )
      return NextResponse.json(
        { error: 'KVK lookup is not configured.' },
        { status: 500 }
      )
    }

    const upstreamUrl = `${baseUrl}/v1/basisprofielen/${encodeURIComponent(
      kvkNummerRaw
    )}`

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          apikey: apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      })
    } catch (fetchErr) {
      console.error('kvk-profile: upstream fetch failed:', fetchErr)
      return NextResponse.json(
        { error: 'KVK service is temporarily unreachable.' },
        { status: 502 }
      )
    }

    if (upstreamRes.status === 404) {
      return NextResponse.json(
        { error: 'KVK number not found.' },
        { status: 404 }
      )
    }

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => ''
      )
      console.error(
        `kvk-profile: upstream returned ${upstreamRes.status}:`,
        text.slice(0, 500)
      )
      return NextResponse.json(
        { error: 'KVK service returned an error.' },
        { status: 502 }
      )
    }

    let upstreamJson: KvkBasisprofiel
    try {
      upstreamJson = (await upstreamRes.json()) as KvkBasisprofiel
    } catch (parseErr) {
      console.error('kvk-profile: upstream JSON parse failed:', parseErr)
      return NextResponse.json(
        { error: 'KVK service returned an invalid response.' },
        { status: 502 }
      )
    }

    // ---- 5. Map and cache ------------------------------------------------
    const payload = mapProfile(upstreamJson, kvkNummerRaw)

    try {
      await redis.set(cacheKey, payload, {
        ex: PROFILE_CACHE_TTL_SECONDS,
      })
    } catch (cacheErr) {
      console.warn('kvk-profile: cache write failed:', cacheErr)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error('kvk-profile: unexpected error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
