import { getTranslations } from 'next-intl/server'

type Props = {
  restaurant: {
    display_name: string | null
    legal_name: string | null
    brand_logo_url: string | null
    brand_display_font_family: string | null
  }
  tableLabel: string
}

/**
 * Slim sticky header for QR routes (welcome + menu). Replaces the Phase 1
 * `RestaurantHeader` hero band — a guest who scanned the table sticker
 * already knows where they are, so this skips hours/address/phone and just
 * confirms identity + table.
 */
export async function QrHeader({ restaurant, tableLabel }: Props) {
  const t = await getTranslations('consumer.menu')
  const name = restaurant.display_name || restaurant.legal_name || ''

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
        {restaurant.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.brand_logo_url}
            alt={name}
            style={{
              height: '32px',
              objectFit: 'contain',
              borderRadius: '6px',
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: restaurant.brand_display_font_family || 'var(--font-jost), sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              color: 'var(--night, #0f0d08)',
            }}
          >
            {name}
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
