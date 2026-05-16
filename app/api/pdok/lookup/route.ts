// app/api/pdok/lookup/route.ts
//
// Server-side proxy for the Dutch government's PDOK Locatieserver, used
// to autofill street and city from a postcode + house number in Step 2
// of the onboarding flow.
//
// Why PDOK:
//   - Free, no API key required, run by the Dutch Kadaster.
//   - Authoritative source for Dutch addresses.
//   - Same architectural pattern as our KVK routes (server-only, Upstash
//     cache, rate-limited, narrow output shape).
//
// Request:
//   GET /api/pdok/lookup?postcode=1012AB&huisnummer=12
//   GET /api/pdok/lookup?postcode=1012AB                  (postcode only)
//
// Response (200, found):
//   {
//     "ok": true,
//     "address": {
//       "street":      "Damrak",
//       "houseNumber": "12",       // empty when only postcode was given
//       "postcode":    "1012AB",   // normalised, no internal space
//       "city":        "Amsterdam"
//     }
//   }
//
// Response (200, not found):
//   { "ok": false, "error": "Address not found." }
//
// Errors:
//   - 400  invalid postcode format
//   - 429  rate limited
//   - 502  PDOK upstream error
//   - 500  unexpected internal error

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: false,
  prefix: 'pdok-lookup',
})

const PDOK_CACHE_TTL_SECONDS = 24 * 60 * 60 // 24h
const POSTCODE_REGEX = /^\d{4}[A-Z]{2}$/

// PDOK Locatieserver — public endpoint, no auth needed.
const PDOK_BASE_URL =
  'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'

// ---- PDOK upstream types --------------------------------------------------
//
// PDOK returns an Apache Solr-style response. Only the fields we read are
// modelled — everything else is ignored.

type PdokDoc = {
  straatnaam?: string
  huisnummer?: number | string
  postcode?: string
  woonplaatsnaam?: string
  type?: string // "adres" | "postcode" | "weg" | ...
}

type PdokResponse = {
  response?: {
    numFound?: number
    docs?: PdokDoc[]
  }
}

// ---- Our narrow output shape ---------------------------------------------

type NormalisedAddress = {
  street: string
  houseNumber: string
  postcode: string
  city: string
}

type LookupSuccess = { ok: true; address: NormalisedAddress }
type LookupFailure = { ok: false; error: string }
type LookupPayload = LookupSuccess | LookupFailure

// ---- Helpers --------------------------------------------------------------

function normalisePostcode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

function normaliseHuisnummerToDigits(raw: string): string {
  // PDOK's huisnummer param accepts integers. Strip any alphabetic suffix
  // (e.g. "12A" → "12") so the upstream call still finds the address.
  const m = raw.trim().match(/^\d+/)
  return m ? m[0] : ''
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumberOrStringToString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

// Pick the best document from PDOK's response.
//   - If a specific huisnummer was requested, prefer the doc whose
//     huisnummer matches exactly.
//   - Otherwise prefer any doc of type "adres" (real address) or "postcode".
//   - Falls back to the first doc.
function pickDoc(
  docs: PdokDoc[],
  requestedHuisnummer: string
): PdokDoc | null {
  if (docs.length === 0) return null

  if (requestedHuisnummer) {
    const exact = docs.find(
      (d) => asNumberOrStringToString(d.huisnummer) === requestedHuisnummer
    )
    if (exact) return exact
  }

  const adres = docs.find((d) => d.type === 'adres')
  if (adres) return adres

  const postcodeDoc = docs.find((d) => d.type === 'postcode')
  if (postcodeDoc) return postcodeDoc

  return docs[0] ?? null
}

// ---- Route handler --------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawPostcode = (searchParams.get('postcode') ?? '').trim()
    const rawHuisnummer = (searchParams.get('huisnummer') ?? '').trim()

    if (!rawPostcode) {
      return NextResponse.json(
        { ok: false, error: 'postcode is required.' },
        { status: 400 }
      )
    }

    const postcode = normalisePostcode(rawPostcode)
    if (!POSTCODE_REGEX.test(postcode)) {
      return NextResponse.json(
        { ok: false, error: 'postcode must be in format 1234AB.' },
        { status: 400 }
      )
    }

    const huisnummer = normaliseHuisnummerToDigits(rawHuisnummer)

    // Rate limit by IP
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
        { ok: false, error: 'Too many lookup requests. Please slow down.' },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() },
        }
      )
    }

    // Cache lookup
    const cacheKey = `pdok:lookup:v1:${postcode}:${huisnummer}`
    try {
      const cached = await redis.get<LookupPayload>(cacheKey)
      if (cached && typeof cached === 'object' && 'ok' in cached) {
        return NextResponse.json(cached, { status: 200 })
      }
    } catch (cacheErr) {
      console.warn('pdok-lookup: cache read failed:', cacheErr)
    }

    // Build PDOK query
    // PDOK's "free" endpoint accepts a `q` parameter with the Solr query.
    // For exact lookup we use:   q=postcode:1012AB AND huisnummer:12&fq=type:adres
    // For postcode-only:         q=postcode:1012AB&fq=type:postcode
    const upstreamUrl = new URL(PDOK_BASE_URL)
    if (huisnummer) {
      upstreamUrl.searchParams.set(
        'q',
        `postcode:${postcode} AND huisnummer:${huisnummer}`
      )
      upstreamUrl.searchParams.set('fq', 'type:adres')
    } else {
      upstreamUrl.searchParams.set('q', `postcode:${postcode}`)
      upstreamUrl.searchParams.set('fq', 'type:postcode')
    }
    upstreamUrl.searchParams.set('rows', '5')

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
    } catch (fetchErr) {
      console.error('pdok-lookup: upstream fetch failed:', fetchErr)
      return NextResponse.json(
        { ok: false, error: 'PDOK service is temporarily unreachable.' },
        { status: 502 }
      )
    }

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      console.error(
        `pdok-lookup: upstream returned ${upstreamRes.status}:`,
        text.slice(0, 500)
      )
      return NextResponse.json(
        { ok: false, error: 'PDOK service returned an error.' },
        { status: 502 }
      )
    }

    let upstreamJson: PdokResponse
    try {
      upstreamJson = (await upstreamRes.json()) as PdokResponse
    } catch (parseErr) {
      console.error('pdok-lookup: upstream JSON parse failed:', parseErr)
      return NextResponse.json(
        { ok: false, error: 'PDOK service returned an invalid response.' },
        { status: 502 }
      )
    }

    const docs = Array.isArray(upstreamJson.response?.docs)
      ? upstreamJson.response.docs
      : []

    const picked = pickDoc(docs, huisnummer)

    let payload: LookupPayload
    if (!picked) {
      payload = { ok: false, error: 'Address not found.' }
    } else {
      const docPostcode = normalisePostcode(asString(picked.postcode))
      payload = {
        ok: true,
        address: {
          street: asString(picked.straatnaam),
          houseNumber: huisnummer
            ? asNumberOrStringToString(picked.huisnummer) || huisnummer
            : '',
          postcode: POSTCODE_REGEX.test(docPostcode)
            ? docPostcode
            : postcode,
          city: asString(picked.woonplaatsnaam),
        },
      }
    }

    // Write-through cache
    try {
      await redis.set(cacheKey, payload, {
        ex: PDOK_CACHE_TTL_SECONDS,
      })
    } catch (cacheErr) {
      console.warn('pdok-lookup: cache write failed:', cacheErr)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error('pdok-lookup: unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
