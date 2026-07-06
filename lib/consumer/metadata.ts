import 'server-only'
import type { Metadata } from 'next'
import type { PublicRestaurant } from './resolveRestaurant'

export type MetadataIntent = 'landing' | 'book' | 'order' | 'qr' | 'qr_menu'

const SITE = 'The Tafel'

/**
 * Pick a sensible display name. Falls back across display_name → legal_name → slug
 * so we never emit a `null` or empty string into a title.
 */
function pickName(r: PublicRestaurant): string {
  if (r.display_name && r.display_name.trim()) return r.display_name.trim()
  if (r.legal_name && r.legal_name.trim()) return r.legal_name.trim()
  return r.slug
}

/**
 * Capitalise the first character if it's lowercase ASCII. Otherwise pass through.
 * Cuisine strings come from the restaurant's own input — "Italiaans", "Asian fusion",
 * etc. — and we only normalise the first letter, never the rest.
 */
function tidyCuisine(s: string | null | undefined): string {
  if (!s) return ''
  const trimmed = s.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

/**
 * Build the OG title for the given intent and locale.
 */
function buildTitle(
  name: string,
  intent: MetadataIntent,
  locale: 'nl' | 'en',
  tableLabel?: string
): string {
  if (intent === 'book') {
    return locale === 'en'
      ? `Book a table at ${name} · ${SITE}`
      : `Reserveer bij ${name} · ${SITE}`
  }
  if (intent === 'order') {
    return locale === 'en'
      ? `Order from ${name} · ${SITE}`
      : `Bestel bij ${name} · ${SITE}`
  }
  if (intent === 'qr') {
    if (!tableLabel) return `${name} · ${SITE}`
    return locale === 'en'
      ? `${name} — Table ${tableLabel} — order from your table`
      : `${name} — Tafel ${tableLabel} — bestel vanaf je tafel`
  }
  if (intent === 'qr_menu') {
    return `Menu — ${name} · ${SITE}`
  }
  // landing
  return `${name} · ${SITE}`
}

/**
 * Build the meta description. Keeps under 160 chars for SEO safety.
 */
function buildDescription(
  r: PublicRestaurant,
  intent: MetadataIntent,
  locale: 'nl' | 'en'
): string {
  const cuisine = tidyCuisine(r.cuisine_type)
  const city = r.legal_address_city?.trim() ?? ''

  if (locale === 'en') {
    const where = [cuisine, city].filter(Boolean).join(' restaurant in ')
    const opener = where ? `${where}.` : ''
    if (intent === 'book') {
      return `${opener} Book a table online — fast, simple, no commission platforms.`.trim()
    }
    if (intent === 'order') {
      return `${opener} Order takeaway online — pay upfront, pick up at your time.`.trim()
    }
    if (intent === 'qr' || intent === 'qr_menu') {
      return city
        ? `Order right from your table at ${pickName(r)} in ${city}.`
        : `Order right from your table at ${pickName(r)}.`
    }
    return `${opener} Discover the menu and book a table on The Tafel.`.trim()
  }

  // NL
  const wherePieces: string[] = []
  if (cuisine) wherePieces.push(`${cuisine} restaurant`)
  if (city) wherePieces.push(`in ${city}`)
  const opener = wherePieces.length ? `${wherePieces.join(' ')}.` : ''
  if (intent === 'book') {
    return `${opener} Reserveer eenvoudig online een tafel.`.trim()
  }
  if (intent === 'order') {
    return `${opener} Bestel afhalen online — betaal direct, haal op je tijd.`.trim()
  }
  if (intent === 'qr' || intent === 'qr_menu') {
    return city
      ? `Bestel direct vanaf je tafel bij ${pickName(r)} in ${city}.`
      : `Bestel direct vanaf je tafel bij ${pickName(r)}.`
  }
  return `${opener} Bekijk de kaart en reserveer via The Tafel.`.trim()
}

/**
 * Build the localised URL pair: canonical (NL) and the EN alternate.
 *
 * Per brand rule Dutch is canonical. Search engines that crawl both locales
 * see the NL URL as the authoritative one and the EN URL as an `alternate`.
 */
function buildUrls(slug: string, intent: MetadataIntent) {
  const path = intent === 'book' ? `/book` : intent === 'order' ? `/order` : ''
  return {
    canonicalPath: `/r/${slug}${path}`,
    enPath: `/en/r/${slug}${path}`,
  }
}

type OgImageEntry = { url: string; alt: string }

/**
 * Build the OG image array. Returns the restaurant's own hero photo when set,
 * otherwise returns an empty array so Next falls back to the file-based
 * opengraph-image.tsx convention.
 *
 * NB: we do NOT set width/height for the hero photo because we don't know the
 * uploaded aspect ratio. WhatsApp / iMessage / Slack handle this fine.
 */
function buildOgImages(r: PublicRestaurant): OgImageEntry[] {
  if (r.hero_image_url) {
    return [{ url: r.hero_image_url, alt: pickName(r) }]
  }
  return []
}

/**
 * Build the full Metadata for a consumer restaurant page.
 *
 * When the restaurant doesn't resolve (slug not found / not live) we return
 * a generic block — Next still emits a noindex / 404-friendly response from
 * the page's `notFound()` call.
 */
export function buildRestaurantMetadata(args: {
  restaurant: PublicRestaurant | null
  locale: 'nl' | 'en'
  slug: string
  intent: MetadataIntent
  tableLabel?: string
}): Metadata {
  const { restaurant, locale, slug, intent, tableLabel } = args

  if (!restaurant) {
    return {
      title: locale === 'en' ? `Not found · ${SITE}` : `Niet gevonden · ${SITE}`,
      robots: { index: false, follow: false },
    }
  }

  const name = pickName(restaurant)
  const title = buildTitle(name, intent, locale, tableLabel)
  const description = buildDescription(restaurant, intent, locale)
  const { canonicalPath, enPath } = buildUrls(slug, intent)
  const images = buildOgImages(restaurant)
  const robots =
    intent === 'qr' || intent === 'qr_menu'
      ? { index: false, follow: false }
      : { index: true, follow: true }

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        'nl-NL': canonicalPath,
        en: enPath,
      },
    },
    openGraph: {
      title,
      description,
      url: locale === 'en' ? enPath : canonicalPath,
      siteName: SITE,
      locale: locale === 'en' ? 'en_US' : 'nl_NL',
      type: 'website',
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images.length ? { images: images as unknown as string[] } : {}),
    },
    robots,
  }
}
