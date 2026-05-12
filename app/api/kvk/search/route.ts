// app/api/kvk/search/route.ts
//
// Typeahead search proxy for the Dutch Chamber of Commerce (KVK) Zoeken API.
//
// Per Phase C kickoff prompt:
//   - All KVK calls server-side only.
//   - Rate limit: 10 calls per IP per minute.
//   - Cache results in Upstash with 5min TTL.
//
// KVK V2 Zoeken response shape (confirmed against the test environment):
//   {
//     "pagina": 1,
//     "resultatenPerPagina": 10,
//     "totaal": 3,
//     "resultaten": [
//       {
//         "kvkNummer": "68750110",
//         "naam": "Test BV Donald",
//         "type": "rechtspersoon" | "hoofdvestiging" | "nevenvestiging",
//         "vestigingsnummer": "000037178598",       // only on vestigings
//         "adres": {
//           "binnenlandsAdres": {                   // or "buitenlandsAdres"
//             "type": "bezoekadres",
//             "straatnaam": "Hizzaarderlaan",
//             "plaats": "Lollum"
//           }
//         },
//         "links": [...]
//       },
//       ...
//     ]
//   }
//
// One KVK number can appear up to 3 times in a single response:
//   - "rechtspersoon"   — the bare legal entity (often has NO adres)
//   - "hoofdvestiging"  — the main branch (the actual restaurant venue)
//   - "nevenvestiging"  — secondary branches
//
// For onboarding we deduplicate by kvkNummer and prefer hoofdvestiging
// (the actual venue address), falling back to rechtspersoon, then
// nevenvestiging. This means the user sees one row per business with the
// most useful address pre-filled.
//
// Response shape (stable narrow contract):
//   { results: [{ kvkNummer, handelsnaam, plaats }, ...] }
//
// We keep the OUTPUT field name "handelsnaam" because that's the Dutch
// business-name convention the rest of our app uses (and it matches the
// Basisprofiel response in /api/kvk/profile). The KVK V2 Zoeken endpoint
// just happens to call it "naam" internally — we normalise on the way out.

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: false,
  prefix: 'kvk-search',
})

const SEARCH_CACHE_TTL_SECONDS = 5 * 60
const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 10

type KvkAdres = {
  binnenlandsAdres?: {
    straatnaam?: string
    plaats?: string
  }
  buitenlandsAdres?: {
    plaats?: string
  }
}

type KvkZoekenResultaat = {
  kvkNummer?: string
  naam?: string
  type?: string // "rechtspersoon" | "hoofdvestiging" | "nevenvestiging"
  vestigingsnummer?: string
  adres?: KvkAdres
}

type KvkZoekenResponse = {
  resultaten?: KvkZoekenResultaat[]
}

type MappedResult = {
  kvkNummer: string
  handelsnaam: string
  plaats: string
}

type CachedPayload = {
  results: MappedResult[]
}

// Priority order for picking the "best" row when a KVK number appears
// multiple times in the response. Lower number = higher priority.
function typePriority(type: string | undefined): number {
  switch (type) {
    case 'hoofdvestiging':
      return 0
    case 'rechtspersoon':
      return 1
    case 'nevenvestiging':
      return 2
    default:
      return 3
  }
}

function extractPlaats(adres: KvkAdres | undefined): string {
  if (!adres) return ''
  if (
    adres.binnenlandsAdres &&
    typeof adres.binnenlandsAdres.plaats === 'string'
  ) {
    return adres.binnenlandsAdres.plaats
  }
  if (
    adres.buitenlandsAdres &&
    typeof adres.buitenlandsAdres.plaats === 'string'
  ) {
    return adres.buitenlandsAdres.plaats
  }
  return ''
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = (searchParams.get('q') ?? '').trim()

    if (rawQuery.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { results: [] satisfies MappedResult[] },
        { status: 200 }
      )
    }

    const isAllDigits = /^\d+$/.test(rawQuery)
    const mode: 'n' | 't' = isAllDigits ? 'n' : 't'
    const normalized = rawQuery.toLowerCase()

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
        { error: 'Too many search requests. Please slow down.' },
        {
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() },
        }
      )
    }

    // Cache lookup — version the key (v2) so the old cached empties from
    // the buggy mapper don't poison results. After this deploy the old
    // keys (kvk:search:n:68750110 etc.) will simply expire untouched.
    const cacheKey = `kvk:search:v2:${mode}:${normalized}`
    try {
      const cached = await redis.get<CachedPayload>(cacheKey)
      if (cached && Array.isArray(cached.results)) {
        return NextResponse.json(cached, { status: 200 })
      }
    } catch (cacheErr) {
      console.warn('kvk-search: cache read failed:', cacheErr)
    }

    // Upstream KVK call
    const apiKey = process.env.KVK_API_KEY
    const baseUrl = process.env.KVK_API_BASE_URL

    if (!apiKey || !baseUrl) {
      console.error('kvk-search: KVK_API_KEY or KVK_API_BASE_URL missing')
      return NextResponse.json(
        { error: 'KVK lookup is not configured.' },
        { status: 500 }
      )
    }

    const upstreamUrl = new URL(`${baseUrl}/v2/zoeken`)
    if (isAllDigits) {
      upstreamUrl.searchParams.set('kvkNummer', rawQuery)
    } else {
      upstreamUrl.searchParams.set('naam', rawQuery)
    }
    upstreamUrl.searchParams.set('pagina', '1')
    upstreamUrl.searchParams.set(
      'resultatenperpagina',
      String(MAX_RESULTS)
    )

    let upstreamRes: Response
    try {
      upstreamRes = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          apikey: apiKey,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
    } catch (fetchErr) {
      console.error('kvk-search: upstream fetch failed:', fetchErr)
      return NextResponse.json(
        { error: 'KVK service is temporarily unreachable.' },
        { status: 502 }
      )
    }

    // KVK returns 404 when the search has no results — treat as empty.
    if (upstreamRes.status === 404) {
      const empty: CachedPayload = { results: [] }
      try {
        await redis.set(cacheKey, empty, {
          ex: SEARCH_CACHE_TTL_SECONDS,
        })
      } catch (cacheErr) {
        console.warn('kvk-search: cache write failed:', cacheErr)
      }
      return NextResponse.json(empty, { status: 200 })
    }

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '')
      console.error(
        `kvk-search: upstream returned ${upstreamRes.status}:`,
        text.slice(0, 500)
      )
      return NextResponse.json(
        { error: 'KVK service returned an error.' },
        { status: 502 }
      )
    }

    let upstreamJson: KvkZoekenResponse
    try {
      upstreamJson = (await upstreamRes.json()) as KvkZoekenResponse
    } catch (parseErr) {
      console.error('kvk-search: upstream JSON parse failed:', parseErr)
      return NextResponse.json(
        { error: 'KVK service returned an invalid response.' },
        { status: 502 }
      )
    }

    const rawResults = Array.isArray(upstreamJson.resultaten)
      ? upstreamJson.resultaten
      : []

    // Dedupe by kvkNummer, keeping the highest-priority row (hoofdvestiging
    // > rechtspersoon > nevenvestiging). For each KVK number we end up with
    // one row showing the most useful address.
    const byKvkNummer = new Map<string, KvkZoekenResultaat>()
    for (const r of rawResults) {
      if (typeof r.kvkNummer !== 'string' || !r.kvkNummer) continue
      const existing = byKvkNummer.get(r.kvkNummer)
      if (
        !existing ||
        typePriority(r.type) < typePriority(existing.type)
      ) {
        byKvkNummer.set(r.kvkNummer, r)
      }
    }

    const mapped: MappedResult[] = Array.from(byKvkNummer.values())
      .map((r) => ({
        kvkNummer: r.kvkNummer ?? '',
        handelsnaam: typeof r.naam === 'string' ? r.naam : '',
        plaats: extractPlaats(r.adres),
      }))
      .filter((r) => r.kvkNummer.length > 0 && r.handelsnaam.length > 0)
      .slice(0, MAX_RESULTS)

    const payload: CachedPayload = { results: mapped }

    try {
      await redis.set(cacheKey, payload, {
        ex: SEARCH_CACHE_TTL_SECONDS,
      })
    } catch (cacheErr) {
      console.warn('kvk-search: cache write failed:', cacheErr)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error('kvk-search: unexpected error:', err)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
