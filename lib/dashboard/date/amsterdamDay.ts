/**
 * Shared Europe/Amsterdam civil-day helpers for dashboard pages that need
 * "today" or an arbitrary day boundary (Vandaag, Reserveringen, …).
 *
 * Deliberately self-contained — does NOT import from lib/booking/queries.ts.
 * That file also exports `loadAvailabilityInputs`, which pulls in the
 * service-role Supabase admin client (`next/headers` chain); since ES module
 * evaluation is whole-file, importing even a pure helper from it drags that
 * chain along too, which breaks the moment a Client Component (BookingsClient)
 * imports this file. amsterdamWallClockToUtc/nextLocalDate are duplicated
 * here instead — same three functions, same logic, no cross-module risk.
 */

const RESTAURANT_TZ = 'Europe/Amsterdam'
const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** "YYYY-MM-DD" civil date in Europe/Amsterdam for the given instant. */
export function amsterdamCivilDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/**
 * Offset of Europe/Amsterdam from UTC, in minutes, at the given instant.
 * CET = +60, CEST = +120.
 */
function amsterdamOffsetMinutes(instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value
    return acc
  }, {})
  const wallUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return Math.round((wallUtc - instant.getTime()) / 60_000)
}

/**
 * Compute the absolute UTC instant for a wall-clock (YYYY-MM-DD, HH:MM:SS)
 * in Europe/Amsterdam. Handles DST correctly by probing the UTC offset at
 * the candidate instant.
 */
export function amsterdamWallClockToUtc(dateLocal: string, time: string): Date {
  const [y, m, d] = dateLocal.split('-').map(Number)
  const [hh, mm, ss = '0'] = time.split(':')
  const targetMinutesUtc = Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss))

  let guess = new Date(targetMinutesUtc)
  for (let i = 0; i < 2; i++) {
    const offsetMin = amsterdamOffsetMinutes(guess)
    guess = new Date(targetMinutesUtc - offsetMin * 60_000)
  }
  return guess
}

/** The Europe/Amsterdam civil date one day after `dateLocal`. */
export function nextLocalDate(dateLocal: string): string {
  const [y, m, d] = dateLocal.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  utc.setUTCDate(utc.getUTCDate() + 1)
  return utc.toISOString().slice(0, 10)
}

/** [startUtcIso, endUtcIso) for the restaurant-local day `civilDate` (YYYY-MM-DD). */
export function amsterdamDayBoundsUtc(civilDate: string): { startUtc: string; endUtc: string } {
  const start = amsterdamWallClockToUtc(civilDate, '00:00:00')
  const end = amsterdamWallClockToUtc(nextLocalDate(civilDate), '00:00:00')
  return { startUtc: start.toISOString(), endUtc: end.toISOString() }
}

/**
 * Parses a `?date=` query param into a validated "YYYY-MM-DD" civil date.
 * Returns null for anything malformed, non-existent (e.g. Feb 30), or
 * outside [today-30d, today+90d] — callers redirect to today on null.
 */
export function parseCivilDateParam(
  raw: string | undefined | null,
  now: Date = new Date()
): string | null {
  if (!raw || !CIVIL_DATE_RE.test(raw)) return null

  const [y, m, d] = raw.split('-').map(Number)
  const asUtc = new Date(Date.UTC(y, m - 1, d))
  // Reject dates that don't round-trip (e.g. 2026-02-30 → March 2).
  if (
    asUtc.getUTCFullYear() !== y ||
    asUtc.getUTCMonth() !== m - 1 ||
    asUtc.getUTCDate() !== d
  ) {
    return null
  }

  const today = amsterdamCivilDate(now)
  const todayUtc = new Date(`${today}T00:00:00Z`)
  const minUtc = new Date(todayUtc)
  minUtc.setUTCDate(minUtc.getUTCDate() - 30)
  const maxUtc = new Date(todayUtc)
  maxUtc.setUTCDate(maxUtc.getUTCDate() + 90)

  if (asUtc < minUtc || asUtc > maxUtc) return null

  return raw
}

/** "zaterdag 25 juli" / "Saturday 25 July" — no year, matches DateNav's tone. */
export function formatDateHeading(civilDate: string, locale: 'nl' | 'en'): string {
  const [y, m, d] = civilDate.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12))
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    timeZone: RESTAURANT_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(noonUtc)
}
