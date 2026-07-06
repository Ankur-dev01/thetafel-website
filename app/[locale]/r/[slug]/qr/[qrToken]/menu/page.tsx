import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveTable } from '@/lib/qr/resolveTable'
import { fetchMenu } from '@/lib/menu/fetchMenu'
import { RestaurantHeader } from '@/components/consumer/RestaurantHeader'
import { QrWelcome } from '@/components/consumer/qr/QrWelcome'
import { MenuBrowser } from '@/components/consumer/menu/MenuBrowser'
import { buildRestaurantMetadata } from '@/lib/consumer/metadata'
import { auditLog } from '@/lib/consumer/audit'

export const revalidate = 60

const TOKEN_RE = /^[A-Za-z0-9_-]{20,32}$/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}): Promise<Metadata> {
  const { locale, slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) {
    return buildRestaurantMetadata({
      restaurant: null,
      locale: locale as 'nl' | 'en',
      slug,
      intent: 'qr_menu',
    })
  }

  const result = await resolveTable(slug, qrToken)

  return buildRestaurantMetadata({
    restaurant: result.status === 'ok' ? result.restaurant : null,
    locale: locale as 'nl' | 'en',
    slug,
    intent: 'qr_menu',
    tableLabel: result.status === 'ok' ? result.table.label : undefined,
  })
}

/**
 * Q1 menu page — reached from the C5.1 QR welcome page's "Bekijk menu" CTA.
 */
export default async function QrMenuPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; qrToken: string }>
}) {
  const { locale, slug, qrToken } = await params

  if (!TOKEN_RE.test(qrToken)) notFound()

  const result = await resolveTable(slug, qrToken)

  switch (result.status) {
    case 'restaurant_not_found':
      notFound()
    case 'qr_disabled_restaurant':
      redirect(`/r/${slug}`)
    case 'qr_disabled_table':
    case 'unknown_table':
      return <QrWelcome mode="unknown_table" restaurant={null} table={null} />
    case 'ok': {
      const { restaurant, table } = result
      const menuData = await fetchMenu(
        restaurant.id,
        'qr',
        locale as 'nl' | 'en'
      )

      try {
        await auditLog({
          restaurantId: restaurant.id,
          eventType: 'qr.menu_viewed',
          eventData: {
            table_id: table.id,
            category_count: menuData.categories.length,
            item_count: menuData.categories.reduce(
              (sum, c) => sum + c.items.length,
              0
            ),
          },
          actorType: 'guest',
        })
      } catch (err) {
        console.error('[QrMenuPage] audit log failed', err)
      }

      return (
        <>
          <RestaurantHeader restaurant={restaurant} />
          <TableEyebrow label={table.label} />
          {menuData.categories.length === 0 ? (
            <EmptyState />
          ) : (
            <MenuBrowser
              restaurant={restaurant}
              menu={menuData}
              table={table}
              context="qr"
              itemNotesEnabled={restaurant.qr_item_notes_enabled}
            />
          )}
        </>
      )
    }
  }
}

async function TableEyebrow({ label }: { label: string }) {
  const t = await getTranslations('consumer.menu')
  return (
    <p
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '16px 16px 0',
        fontFamily: 'var(--font-jost), sans-serif',
        fontWeight: 600,
        fontSize: '12px',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--amber, #d4820a)',
      }}
    >
      {t('eyebrowTable', { label })}
    </p>
  )
}

async function EmptyState() {
  const t = await getTranslations('consumer.menu')
  return (
    <section
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '48px 24px 80px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(28px, 6vw, 36px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {t('emptyStateHeading')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('emptyStateBody')}
      </p>
    </section>
  )
}
