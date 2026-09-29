// lib/booking/confirmationTemplate.ts
//
// D5.6c: shared, client-safe logic for the restaurant's custom booking
// confirmation message (restaurants.confirmation_template_nl/_en).
//
// No `server-only` import — this must be importable from the onboarding
// Step 6 editor and the dashboard settings editor (both client components)
// as well as from the server-side email renderer. No DB access, no Node
// APIs, pure functions only.

export const CONFIRMATION_PLACEHOLDERS = [
  'naam',
  'restaurant',
  'datum',
  'tijd',
  'gasten',
  'adres',
] as const

export type ConfirmationPlaceholder = (typeof CONFIRMATION_PLACEHOLDERS)[number]

export type ConfirmationVars = {
  naam: string
  restaurant: string
  datum: string
  tijd: string
  gasten: string
  adres: string | null
}

const PLACEHOLDER_RE = /\{(naam|restaurant|datum|tijd|gasten|adres)\}/g

/**
 * First-name extraction, reimplemented here (not imported) because
 * lib/consumer/email/escape.ts is `server-only` and this file must not be.
 * Same logic: first whitespace-separated token, trimmed, fallback to the
 * full string. Keep in sync manually if escape.ts's firstNameOf changes.
 */
function firstNameOfClientSafe(fullName: string, fallback: string = ''): string {
  if (!fullName || typeof fullName !== 'string') return fallback
  const first = fullName.trim().split(/\s+/)[0]
  return first || fallback
}

export function formatConfirmationDate(slot: Date | string, locale: 'nl' | 'en'): string {
  const date = typeof slot === 'string' ? new Date(slot) : slot
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatConfirmationTime(slot: Date | string, locale: 'nl' | 'en'): string {
  const date = typeof slot === 'string' ? new Date(slot) : slot
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatGuestCount(n: number, locale: 'nl' | 'en'): string {
  if (locale === 'en') return `${n} ${n === 1 ? 'guest' : 'guests'}`
  return `${n} ${n === 1 ? 'persoon' : 'personen'}`
}

export function buildConfirmationVars(args: {
  locale: 'nl' | 'en'
  guestFullName: string
  restaurantName: string
  slotTime: Date | string
  partySize: number
  address: string | null
}): ConfirmationVars {
  return {
    naam: firstNameOfClientSafe(args.guestFullName, args.locale === 'en' ? 'there' : 'daar'),
    restaurant: args.restaurantName,
    datum: formatConfirmationDate(args.slotTime, args.locale),
    tijd: formatConfirmationTime(args.slotTime, args.locale),
    gasten: formatGuestCount(args.partySize, args.locale),
    adres: args.address,
  }
}

/**
 * Substitutes placeholders in `template` with `vars`. Returns plain text —
 * NOT HTML-escaped; callers embedding this in HTML must escape the result
 * themselves (see bookingConfirmation.ts).
 *
 * Decision 4: if `vars.adres` is null/empty, every LINE containing
 * `{adres}` is removed entirely before substitution, so the guest never
 * sees a dangling "Adres:" with nothing after it. Unknown `{tokens}` are
 * left as-is.
 */
export function renderConfirmationTemplate(template: string, vars: ConfirmationVars): string {
  const hasAddress = typeof vars.adres === 'string' && vars.adres.trim().length > 0

  const lines = template.split('\n')
  const filteredLines = hasAddress
    ? lines
    : lines.filter((line) => !line.includes('{adres}'))

  const values: Record<ConfirmationPlaceholder, string> = {
    naam: vars.naam,
    restaurant: vars.restaurant,
    datum: vars.datum,
    tijd: vars.tijd,
    gasten: vars.gasten,
    adres: hasAddress ? (vars.adres as string) : '',
  }

  return filteredLines
    .join('\n')
    .replace(PLACEHOLDER_RE, (match, token: ConfirmationPlaceholder) => values[token] ?? match)
}

// ── Hydration-safe sample slot time (for editor previews only) ─────────────
//
// The two live editor previews (onboarding Step 6, dashboard
// /settings/booking) need a "3 days from now, 19:30" sample instant. Reading
// `new Date()` directly during render is unsafe here: these are Client
// Components, so the render that produces the SSR'd HTML and the render
// that hydrates it client-side happen at genuinely different wall-clock
// instants — if those two instants straddle a calendar-day boundary, the
// sample date differs between server and client and React throws a
// hydration mismatch (caught by tests/e2e/dashboard-settings-booking.spec.ts).
//
// Fix: expose this as a useSyncExternalStore-compatible snapshot pair
// (matching this codebase's existing pattern in CookieBanner.tsx for the
// same class of problem) instead of a plain function callers invoke inline.
// getServerSampleSlotTimeSnapshot returns null so SSR and the first client
// render agree; getSampleSlotTimeSnapshot computes the real value once,
// lazily, on first client read, caching it for the module's lifetime so
// repeated snapshot reads stay referentially stable (required by
// useSyncExternalStore — an ever-changing snapshot would loop).

let cachedSampleSlotTime: Date | null = null

/**
 * Amsterdam's current UTC offset in minutes (+60 CET / +120 CEST), read via
 * Intl rather than hardcoded so it's correct across the DST transition.
 * `near` only needs to land on the right calendar date in Amsterdam — the
 * offset is constant across an entire local day except on the transition
 * day itself, which this preview-only helper doesn't need to handle exactly.
 */
function amsterdamOffsetMinutes(near: Date): number {
  const part = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(near)
    .find((p) => p.type === 'timeZoneName')?.value
  const match = part ? /GMT([+-]\d+)/.exec(part) : null
  const offsetHours = match ? parseInt(match[1], 10) : 1
  return offsetHours * 60
}

/**
 * "3 days from now, 19:30" — as an Amsterdam wall-clock time, not the host
 * machine's local time. `new Date().setHours(19, 30, 0, 0)` (the naive
 * approach) sets 19:30 in the SERVER's or BROWSER's own local timezone,
 * which is wrong here — a server running in UTC and a browser running in
 * CEST would each produce a different real-world instant, and either could
 * display as something other than 19:30 once formatted with
 * `timeZone: 'Europe/Amsterdam'` (caught by manual verification: this
 * bug initially rendered as "16:00" in the dashboard preview).
 */
function computeSampleSlotTime(): Date {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate() + 3
  const offsetMin = amsterdamOffsetMinutes(new Date(Date.UTC(y, m, d, 12, 0, 0)))
  return new Date(Date.UTC(y, m, d, 19, 30, 0) - offsetMin * 60_000)
}

export function subscribeSampleSlotTime(): () => void {
  // The sample never changes after first computation — nothing to subscribe to.
  return () => {}
}

export function getSampleSlotTimeSnapshot(): Date {
  if (!cachedSampleSlotTime) cachedSampleSlotTime = computeSampleSlotTime()
  return cachedSampleSlotTime
}

export function getServerSampleSlotTimeSnapshot(): Date | null {
  return null
}

/**
 * Single-line restaurant address, e.g. "Street 12A-bis, 1012XR City".
 * Same composition logic as `formatAddress` in
 * lib/consumer/notifications/dispatchTakeawayConfirmation.ts (kept as a
 * separate, un-refactored implementation there — this is the shared,
 * client-safe version for the confirmation-template feature only).
 */
export function formatRestaurantAddressLine(row: {
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
}): string | null {
  const street = row.legal_address_street ?? ''
  const num = row.legal_address_house_number ?? ''
  const letter = row.legal_address_house_letter ?? ''
  const addition = row.legal_address_house_number_addition ?? ''
  const numWithSuffix = `${num}${letter}${addition ? `-${addition}` : ''}`.trim()
  const streetLine = [street, numWithSuffix].filter(Boolean).join(' ').trim()
  const cityLine = [row.legal_address_postcode, row.legal_address_city].filter(Boolean).join(' ').trim()
  if (!streetLine && !cityLine) return null
  return [streetLine, cityLine].filter(Boolean).join(', ')
}
