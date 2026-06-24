import { ImageResponse } from 'next/og'
import { createSupabasePublicClient } from '@/lib/consumer/supabasePublic'

export const runtime = 'nodejs'
export const alt = 'The Tafel'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

/**
 * Per-restaurant Open Graph fallback image.
 *
 * Auto-discovered by Next.js for every page under /r/[slug]/... and served at
 * /r/[slug]/opengraph-image. Used when `generateMetadata` does NOT set an
 * `openGraph.images` array — i.e. when the restaurant hasn't uploaded a
 * hero photo. When they have, this generator is bypassed.
 *
 * Visual: dark background, restaurant name in large weight-900 text, amber
 * accent line, "thetafel.nl" footer. System sans-serif fallback for the
 * font — Vercel runtime has no fonts installed and bundling Raleway here
 * just for OG isn't worth the bundle size. The composition still reads as
 * The Tafel because of the colour palette.
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>
}) {
  const { slug, locale } = await params

  let displayName = slug
  let cuisine = ''

  try {
    const supabase = createSupabasePublicClient()
    const { data } = await supabase
      .from('restaurants')
      .select('display_name, legal_name, cuisine_type')
      .eq('slug', slug)
      .eq('status', 'live')
      .maybeSingle()

    if (data) {
      const row = data as {
        display_name: string | null
        legal_name: string | null
        cuisine_type: string | null
      }
      displayName = row.display_name || row.legal_name || slug
      cuisine = row.cuisine_type ?? ''
    }
  } catch {
    // Fall through — render with slug as the name. OG must never throw.
  }

  const ctaLine = locale === 'en' ? 'BOOK A TABLE' : 'RESERVEER EEN TAFEL'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0f0d08',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#d4820a',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.18em',
          }}
        >
          {ctaLine}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              color: '#fdfaf5',
              fontSize: clampFontSize(displayName.length),
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              maxWidth: '1040px',
            }}
          >
            {displayName}
          </div>
          {cuisine ? (
            <div
              style={{
                marginTop: 18,
                color: '#9c8b6a',
                fontSize: 30,
                fontWeight: 400,
                letterSpacing: '0.01em',
              }}
            >
              {cuisine}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            color: '#7a7264',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.08em',
          }}
        >
          <span
            style={{
              color: '#fdfaf5',
              fontWeight: 900,
              letterSpacing: '-0.01em',
            }}
          >
            The Tafel
          </span>
          <span>thetafel.nl</span>
        </div>
      </div>
    ),
    { ...size }
  )
}

/**
 * Tone down the headline size for long restaurant names so they don't blow
 * out of the 1040px content column.
 */
function clampFontSize(nameLen: number): number {
  if (nameLen <= 14) return 132
  if (nameLen <= 22) return 108
  if (nameLen <= 32) return 86
  return 70
}
