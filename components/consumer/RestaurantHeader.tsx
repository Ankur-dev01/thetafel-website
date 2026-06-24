import { getLocale } from 'next-intl/server'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import { resolveHoursForRestaurant } from '@/lib/consumer/resolveHours'
import { formatTodayHours } from '@/lib/consumer/formatHours'

/**
 * Public-facing restaurant header.
 *
 * Renders the hero band at the top of every consumer page: photo (or amber
 * fallback), display name, optional cuisine, today's hours, address, phone.
 *
 * Server component — fetches today's hours via the cached resolver. Pass the
 * already-resolved restaurant object from the page; we don't refetch it here.
 */
export async function RestaurantHeader({
  restaurant,
}: {
  restaurant: PublicRestaurant
}) {
  const locale = (await getLocale()) as 'nl' | 'en'
  const hoursRows = await resolveHoursForRestaurant(restaurant.id)
  const today = formatTodayHours(hoursRows, locale)

  const name =
    restaurant.display_name || restaurant.legal_name || restaurant.slug

  const photo = restaurant.hero_image_url

  return (
    <header>
      {/* Hero band */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 7',
          minHeight: '220px',
          maxHeight: '480px',
          overflow: 'hidden',
          backgroundColor: photo
            ? 'var(--night, #0f0d08)'
            : 'var(--amber, #d4820a)',
        }}
      >
        {photo ? (
          // Plain <img> rather than next/image because we don't yet have a
          // loader configured for arbitrary Supabase Storage hosts on the
          // consumer side. The hero is purely decorative — alt is empty.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <AmberWordmarkFallback name={name} />
        )}

        {/* Bottom-up gradient for legibility of any overlaid copy */}
        {photo ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(15,13,8,0) 50%, rgba(15,13,8,0.45) 100%)',
            }}
          />
        ) : null}
      </div>

      {/* Identity strip beneath the hero */}
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '28px 20px 12px',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(32px, 5vw, 48px)',
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {name}
        </h1>
        {restaurant.cuisine_type ? (
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 400,
              fontSize: '15px',
              letterSpacing: '0.02em',
              color: 'var(--stone, #7a7264)',
              margin: '8px 0 0 0',
            }}
          >
            {restaurant.cuisine_type}
          </p>
        ) : null}

        {/* Info chips: hours, address, phone */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 20px',
            marginTop: '20px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
            color: 'var(--night, #0f0d08)',
            alignItems: 'center',
          }}
        >
          <HoursChip status={today.status} label={today.label} />
          {hasFullAddress(restaurant) ? (
            <AddressChip restaurant={restaurant} />
          ) : null}
          {restaurant.contact_phone ? (
            <PhoneChip phone={restaurant.contact_phone} />
          ) : null}
        </div>
      </div>
    </header>
  )
}

function AmberWordmarkFallback({ name }: { name: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(36px, 7vw, 72px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: 'var(--cream, #fdfaf5)',
          textShadow: '0 2px 14px rgba(15,13,8,0.18)',
        }}
      >
        {name}
      </span>
    </div>
  )
}

function HoursChip({
  status,
  label,
}: {
  status: 'open' | 'closed'
  label: string
}) {
  const dotColor =
    status === 'open' ? 'var(--amber, #d4820a)' : 'var(--stone, #7a7264)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </span>
  )
}

function PinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function AddressChip({ restaurant }: { restaurant: PublicRestaurant }) {
  const line1 = formatAddressLine1(restaurant)
  const line2 = formatAddressLine2(restaurant)
  const mapsHref = buildMapsHref(restaurant)

  return (
    <a
      href={mapsHref}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        color: 'inherit',
        textDecoration: 'none',
        borderBottom: '1px solid transparent',
      }}
    >
      <PinIcon />
      <span>
        {line1}
        {line2 ? <>, {line2}</> : null}
      </span>
    </a>
  )
}

function PhoneChip({ phone }: { phone: string }) {
  const telHref = `tel:${phone.replace(/[^\d+]/g, '')}`
  return (
    <a
      href={telHref}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <PhoneIcon />
      <span>{phone}</span>
    </a>
  )
}

function hasFullAddress(r: PublicRestaurant): boolean {
  return Boolean(
    r.legal_address_street &&
      r.legal_address_house_number &&
      r.legal_address_postcode &&
      r.legal_address_city
  )
}

function formatAddressLine1(r: PublicRestaurant): string {
  const street = r.legal_address_street ?? ''
  const num = r.legal_address_house_number ?? ''
  const letter = r.legal_address_house_letter ?? ''
  const add = r.legal_address_house_number_addition ?? ''
  const numWithSuffix = `${num}${letter ? letter : ''}${
    add ? `-${add}` : ''
  }`.trim()
  return [street, numWithSuffix].filter(Boolean).join(' ').trim()
}

function formatAddressLine2(r: PublicRestaurant): string {
  const postcode = r.legal_address_postcode ?? ''
  const city = r.legal_address_city ?? ''
  return [postcode, city].filter(Boolean).join(' ').trim()
}

function buildMapsHref(r: PublicRestaurant): string {
  const q = [formatAddressLine1(r), formatAddressLine2(r), 'Nederland']
    .filter(Boolean)
    .join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
