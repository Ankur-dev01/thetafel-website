import { getTranslations } from 'next-intl/server'
import type { ResolvedBrand } from '@/lib/consumer/brandTokens'

type Props = {
  restaurantName: string
  brand: ResolvedBrand
  tableLabel: string
}

// Must match `DEFAULT_HEADLINE_FONT` in lib/consumer/brandTokens.ts. QrHeader's
// own default (below) is intentionally a smaller sans body font, not the
// resolver's display headline font — this sentinel lets us tell "no custom
// font resolved" apart from "restaurant actually set a custom font" without
// reading `brand_display_font_family` off the raw restaurant row.
const RESOLVER_DEFAULT_HEADLINE_FONT = 'var(--font-raleway), Raleway, sans-serif'
const QR_HEADER_DEFAULT_FONT = 'var(--font-jost), sans-serif'

/**
 * Slim sticky header for QR routes (welcome + menu). Replaces the Phase 1
 * `RestaurantHeader` hero band — a guest who scanned the table sticker
 * already knows where they are, so this skips hours/address/phone and just
 * confirms identity + table.
 */
export async function QrHeader({ restaurantName, brand, tableLabel }: Props) {
  const t = await getTranslations('consumer.menu')
  const fontFamily =
    brand.headlineFontFamily === RESOLVER_DEFAULT_HEADLINE_FONT
      ? QR_HEADER_DEFAULT_FONT
      : brand.headlineFontFamily

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(253, 250, 245, 0.94)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(30, 21, 8, 0.06)',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={restaurantName}
            style={{
              height: '32px',
              objectFit: 'contain',
              borderRadius: '6px',
            }}
          />
        ) : (
          <span
            style={{
              fontFamily,
              fontWeight: 700,
              fontSize: '18px',
              color: 'var(--night, #0f0d08)',
            }}
          >
            {restaurantName}
          </span>
        )}

        <span
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--amber, #d4820a)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('eyebrowTable', { label: tableLabel })}
        </span>
      </div>
    </div>
  )
}
