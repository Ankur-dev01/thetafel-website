// app/api/kvk/search/route.ts
//
// Typeahead search proxy for the Dutch Chamber of Commerce (KVK) Zoeken API.
//
// Per Phase C kickoff prompt:
//   - All KVK calls server-side only.
//   - Cache results in Upstash with 5min TTL.
//
// Configurable behaviour:
//   - Minimum query length: 1 (dropdown opens from the first keystroke).
//   - Rate limit: 30 calls per IP per minute. Tuned for 1-character min:
//     a fast typer hitting 30 keystrokes per minute is plausible, and
//     30/min gives them headroom while still capping cost/abuse.
//
// Smart digit routing:
//   - 8-digit all-numeric query  → /v2/zoeken?kvkNummer={query}
//     (KVK rejects partial numeric values; only exact 8-digit matches.)
//   - 1-7-digit all-numeric query → /v2/zoeken?naam={query}
//     (KVK's name search does substring matching that picks up partial
//     KVK numbers AND company names containing those digits.)
//   - Anything with letters       → /v2/zoeken?naam={query}
//
// One KVK number can appear up to 3 times in a single response
// (rechtspersoon + hoofdvestiging + nevenvestiging). We dedupe and
// prefer hoofdvestiging so the user sees one row per business with the
// actual venue address.

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: false,
  prefix: 'kvk-search',
})

const SEARCH_CACHE_TTL_SECONDS = 5 * 60
const MIN_QUERY_LENGTH = 1
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

    // Smart digit routing.
    //   - 8 digits exactly  → use kvkNummer search (precise lookup)
    //   - 1-7 digits        → use naam search (KVK's name search matches
    //                         partial digit strings; kvkNummer search
    //                         rejects anything less than 8 digits)
    //   - Has any letter    → use naam search
    const isAllDigits = /^\d+$/.test(rawQuery)
    const useKvkNummerSearch = isAllDigits && rawQuery.length === 8
    const mode: 'n' | 't' = useKvkNummerSearch ? 'n' : 't'
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

    // Cache lookup. Key version bumped to v3 so cached error/empty payloads
    // from earlier configurations expire cleanly.
    const cacheKey = `kvk:search:v3:${mode}:${normalized}`
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
    if (useKvkNummerSearch) {
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

    // KVK returns 400 for malformed queries (e.g. partial KVK numbers
    // that slipped through, weird unicode, etc). Treat as empty rather
    // than surfacing the upstream error to the user — the typeahead has
    // plenty of "no match yet" states already.
    if (upstreamRes.status === 400) {
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
    // > rechtspersoon > nevenvestiging).
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
