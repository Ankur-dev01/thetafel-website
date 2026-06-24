import type { AvailabilityRow } from './resolveHours'

/**
 * Compute today's ISO day-of-week (1=Mon, 7=Sun) in Europe/Amsterdam.
 *
 * Vercel's runtime is UTC, but Dutch restaurants operate on local time. A
 * visitor at 23:30 UTC on a Tuesday is at 00:30 or 01:30 Wednesday in
 * Amsterdam — so we must compute the day boundary in the restaurant's
 * timezone, not the server's.
 *
 * We exploit Intl.DateTimeFormat with `weekday: 'short'` and an English
 * locale: this returns 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun' which
 * we map to 1..7. No timezone library required.
 */
export function getAmsterdamIsoDayOfWeek(now: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
  }).format(now)
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  return map[weekday] ?? 1
}

/**
 * Trim "HH:MM:SS" to "HH:MM". Defensive against malformed inputs.
 */
function trimSeconds(t: string | null | undefined): string {
  if (!t || typeof t !== 'string') return ''
  const m = t.match(/^(\d{2}:\d{2})/)
  return m ? m[1]! : ''
}

/**
 * Pick the canonical row(s) for today's hours.
 *
 * Strategy:
 *   1. If a row with service_scope='all' exists for today, that's the
 *      single source of truth — return it.
 *   2. Otherwise the restaurant uses per-service hours. Collapse those rows
 *      into a representative envelope: earliest open, latest close. This
 *      is a reasonable "we're around between X and Y" summary for the
 *      header chip without dragging in per-service complexity.
 *   3. If nothing for today, return null (closed today).
 */
function pickTodayRow(
  rows: AvailabilityRow[],
  todayIso: number
): { open: string; close: string; closesNextDay: boolean } | null {
  const todays = rows.filter((r) => r.day_of_week === todayIso)
  if (todays.length === 0) return null

  const allRow = todays.find((r) => r.service_scope === 'all')
  if (allRow) {
    return {
      open: trimSeconds(allRow.open_time),
      close: trimSeconds(allRow.close_time),
      closesNextDay: allRow.closes_next_day,
    }
  }

  // Per-service: envelope earliest open and latest close.
  // Hours are wall-clock strings; lexicographic comparison works for "HH:MM".
  let earliestOpen = trimSeconds(todays[0]!.open_time)
  let latestClose = trimSeconds(todays[0]!.close_time)
  let anyClosesNextDay = todays[0]!.closes_next_day

  for (const r of todays) {
    const o = trimSeconds(r.open_time)
    const c = trimSeconds(r.close_time)
    if (o && (!earliestOpen || o < earliestOpen)) earliestOpen = o
    if (c && (!latestClose || c > latestClose)) latestClose = c
    if (r.closes_next_day) anyClosesNextDay = true
  }

  if (!earliestOpen || !latestClose) return null
  return { open: earliestOpen, close: latestClose, closesNextDay: anyClosesNextDay }
}

export type TodayHoursStatus = 'open' | 'closed'

export type TodayHoursResult = {
  status: TodayHoursStatus
  /**
   * Localised one-line summary suitable for the header chip.
   * Examples:
   *   nl: "Open van 09:00 – 22:00", "Gesloten vandaag", "Open van 18:00 – 01:00 (morgen)"
   *   en: "Open today 09:00 – 22:00", "Closed today", "Open today 18:00 – 01:00 (next day)"
   */
  label: string
  /** Raw open time "HH:MM" for downstream callers that need the value. Empty when closed. */
  openTime: string
  /** Raw close time "HH:MM" for downstream callers. Empty when closed. */
  closeTime: string
}

/**
 * Build the localised "today" hours summary used in the restaurant header
 * and anywhere else we need a quick open/closed signal.
 */
export function formatTodayHours(
  rows: AvailabilityRow[],
  locale: 'nl' | 'en',
  now: Date = new Date()
): TodayHoursResult {
  const todayIso = getAmsterdamIsoDayOfWeek(now)
  const row = pickTodayRow(rows, todayIso)

  if (!row) {
    return {
      status: 'closed',
      label: locale === 'en' ? 'Closed today' : 'Gesloten vandaag',
      openTime: '',
      closeTime: '',
    }
  }

  const suffix = row.closesNextDay
    ? locale === 'en'
      ? ' (next day)'
      : ' (morgen)'
    : ''

  const label =
    locale === 'en'
      ? `Open today ${row.open} – ${row.close}${suffix}`
      : `Open van ${row.open} – ${row.close}${suffix}`

  return {
    status: 'open',
    label,
    openTime: row.open,
    closeTime: row.close,
  }
}
