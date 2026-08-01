/**
 * Vandaag-page time formatting. All wall-clock display is Europe/Amsterdam
 * regardless of server/client timezone — restaurant operating hours are NL
 * local (same rule as lib/consumer/notifications/format.ts).
 */

const AMSTERDAM_TZ = 'Europe/Amsterdam'

/** "19:30" — Amsterdam wall-clock, 24h. */
export function formatWallClockAmsterdam(instant: Date | string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  const out = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMSTERDAM_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return out === '24:00' ? '00:00' : out
}

/**
 * "5 min geleden" / "over 12 min" / "nu" — relative to `now`, minute
 * granularity. `< 1` minute in either direction renders as "nu".
 */
export function formatRelativeMinutesFromNow(
  instant: Date | string,
  now: Date,
  locale: 'nl' | 'en' = 'nl'
): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  const diffMinutes = Math.round((date.getTime() - now.getTime()) / 60_000)

  if (diffMinutes === 0) return locale === 'nl' ? 'nu' : 'now'

  if (diffMinutes < 0) {
    const n = Math.abs(diffMinutes)
    return locale === 'nl' ? `${n} min geleden` : `${n} min ago`
  }

  return locale === 'nl' ? `over ${diffMinutes} min` : `in ${diffMinutes} min`
}

/** "2u 15m" / "2h 15m" — elapsed duration since `since`, hour+minute granularity, floored. */
export function formatElapsedHoursMinutes(since: Date | string, now: Date, locale: 'nl' | 'en' = 'nl'): string {
  const date = typeof since === 'string' ? new Date(since) : since
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return locale === 'nl' ? `${hours}u ${minutes}m` : `${hours}h ${minutes}m`
}
