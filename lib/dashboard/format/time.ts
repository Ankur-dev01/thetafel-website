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
