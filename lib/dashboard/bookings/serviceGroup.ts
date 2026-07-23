import type { ServiceWindow, ServiceGroupKey } from './types'

/** Amsterdam local hour (0-23) a slot_time instant falls on. */
function amsterdamLocalHour(instant: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      hour12: false,
    }).format(instant)
  )
}

/**
 * Assigns a booking to a service group given the day's windows. Finds the
 * window whose UTC range contains the slot; if the window carries exactly
 * one tag, that's the group. If it carries multiple (or none), splits by a
 * conventional cutoff: local hour < 11 → brunch (if tagged), local hour
 * >= 17 → dinner (if tagged), otherwise lunch (if tagged) — falling back to
 * whichever single tag the window actually has. A slot matching no window
 * at all (shouldn't normally happen — bookings are only ever made inside an
 * open window) lands in "other".
 */
export function resolveServiceGroup(
  slotTimeIso: string,
  windows: ServiceWindow[]
): ServiceGroupKey {
  const slot = new Date(slotTimeIso)
  const match = windows.find((w) => slotTimeIso >= w.open_utc && slotTimeIso < w.close_utc)
  if (!match) return 'other'

  const tags: ServiceGroupKey[] = []
  if (match.tag_brunch) tags.push('brunch')
  if (match.tag_lunch) tags.push('lunch')
  if (match.tag_dinner) tags.push('dinner')

  if (tags.length === 0) return 'other'
  if (tags.length === 1) return tags[0]

  const hour = amsterdamLocalHour(slot)
  if (match.tag_brunch && hour < 11) return 'brunch'
  if (match.tag_dinner && hour >= 17) return 'dinner'
  if (match.tag_lunch) return 'lunch'
  return tags[0]
}
