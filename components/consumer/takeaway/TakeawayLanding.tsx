// components/consumer/takeaway/TakeawayLanding.tsx
//
// T0 takeaway hook banner. The name/cuisine/hero-image hero is already
// covered by the existing <RestaurantHeader> (reused as-is, per C6.1 spec) —
// this component renders only the takeaway-specific banner underneath it:
// "order for pickup" + earliest pickup time / closed-today / unavailable copy.
//
// No client interactivity needed (no state), so this stays a plain server
// component like RestaurantHeader.

import type { OpeningWindowResult } from '@/lib/takeaway/openingWindow'

const TZ = 'Europe/Amsterdam'

type Props = {
  window: OpeningWindowResult
  locale: 'nl' | 'en'
  t: {
    eyebrow: string
    heading: string
    earliestToday: (hhmm: string) => string
    closedToday: (dayName: string, hhmm: string) => string
    unavailableServiceDisabled: string
    unavailableNotAccepting: string
    unavailableNoUpcoming: string
  }
}

function formatHHmm(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function formatDayName(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    weekday: 'long',
  }).format(new Date(iso))
}

export function TakeawayLanding({ window, locale, t }: Props) {
  let banner: { body: string; tone: 'open' | 'closed' | 'unavailable' }

  switch (window.status) {
    case 'open_now':
      banner = {
        body: t.earliestToday(formatHHmm(window.earliestPickupInstant, locale)),
        tone: 'open',
      }
      break
    case 'closed_today':
      banner = {
        body: t.closedToday(
          formatDayName(window.nextOpenInstant, locale),
          formatHHmm(window.nextOpenInstant, locale),
        ),
        tone: 'closed',
      }
      break
    case 'unavailable':
      banner = {
        body:
          window.reason === 'service_disabled'
            ? t.unavailableServiceDisabled
            : window.reason === 'not_accepting_orders'
              ? t.unavailableNotAccepting
              : t.unavailableNoUpcoming,
        tone: 'unavailable',
      }
      break
  }

  const bannerBg =
    banner.tone === 'unavailable' ? '#f2eee7' : banner.tone === 'closed' ? '#fce9e9' : '#fef3e2'
  const bannerText =
    banner.tone === 'unavailable' ? '#5c534a' : banner.tone === 'closed' ? '#8a1010' : '#8a4a08'

  return (
    <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px 12px' }}>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#a86205',
          margin: 0,
        }}
      >
        {t.eyebrow}
      </p>
      <div
        role="status"
        aria-live="polite"
        style={{
          marginTop: '10px',
          backgroundColor: bannerBg,
          color: bannerText,
          borderRadius: '12px',
          padding: '14px 16px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 600,
            fontSize: '15px',
            margin: 0,
          }}
        >
          {t.heading}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            margin: '4px 0 0 0',
            opacity: 0.9,
          }}
        >
          {banner.body}
        </p>
      </div>
    </section>
  )
}
