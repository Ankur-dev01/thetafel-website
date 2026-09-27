import { getTranslations } from 'next-intl/server'
import QRCode from 'qrcode'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import ShareActions from './ShareActions'
import ButtonBuilder from './ButtonBuilder'
import IframeEmbedBuilder from './IframeEmbedBuilder'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

// Matches lib/consumer/notifications/format.ts's established base — always
// the bare production domain, no www., no env var (none exists for this).
const PUBLIC_ORIGIN = 'https://thetafel.nl'

export default async function SharePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations({ locale, namespace: 'dashboard.share' })

  const shareUrl = `${PUBLIC_ORIGIN}/r/${context.restaurant.slug}`

  // Locale-fixed embed URL. `locale === 'nl'` uses the bare origin (Dutch is
  // the default and has no path prefix); `locale === 'en'` adds the `/en`
  // prefix. Restaurant switches dashboard language and re-copies to get the
  // other locale's embed.
  const embedUrl =
    locale === 'en'
      ? `${PUBLIC_ORIGIN}/en/r/${context.restaurant.slug}/book?embed=1`
      : `${PUBLIC_ORIGIN}/r/${context.restaurant.slug}/book?embed=1`

  // Generate an SVG QR server-side. Margin 1 = tight border; width 240 is
  // large enough for on-screen clarity and PNG downscaling looks fine.
  const qrSvg = await QRCode.toString(shareUrl, {
    type: 'svg',
    margin: 1,
    width: 240,
    color: {
      dark: '#1e1508',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  })

  return (
    <div className="max-w-[640px]">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Card 1 — Shareable URL */}
      <section className="mt-6 bg-white rounded-card p-5">
        <h2
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('link.heading')}
        </h2>
        <p
          className="mt-1 text-[13px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('link.description')}
        </p>

        <ShareActions
          shareUrl={shareUrl}
          qrSvg={qrSvg}
          restaurantSlug={context.restaurant.slug}
          labels={{
            copy: t('link.copy'),
            copied: t('link.copied'),
            downloadQr: t('qr.download'),
            downloading: t('qr.downloading'),
          }}
        />
      </section>

      {/* Card 2 — QR code */}
      <section className="mt-4 bg-white rounded-card p-5">
        <h2
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('qr.heading')}
        </h2>
        <p
          className="mt-1 text-[13px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('qr.description')}
        </p>

        <div
          className="mt-4 inline-block rounded-card border border-[#eae2d1] p-3 bg-white"
          data-qr-preview
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </section>

      {/* Card 3 — Book-now HTML button */}
      <section className="mt-4 bg-white rounded-card p-5">
        <h2
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('button.heading')}
        </h2>
        <p
          className="mt-1 text-[13px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('button.description')}
        </p>

        <ButtonBuilder
          shareUrl={shareUrl}
          defaultButtonText={t('button.defaultText')}
          labels={{
            textLabel: t('button.textLabel'),
            textPlaceholder: t('button.textPlaceholder'),
            colorLabel: t('button.colorLabel'),
            colorCustomLabel: t('button.colorCustomLabel'),
            previewLabel: t('button.previewLabel'),
            snippetLabel: t('button.snippetLabel'),
            copy: t('button.copy'),
            copied: t('button.copied'),
          }}
        />
      </section>

      {/* Card 4 — iframe embed */}
      <section className="mt-4 bg-white rounded-card p-5">
        <h2
          className="text-[15px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t('iframe.heading')}
        </h2>
        <p
          className="mt-1 text-[13px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {t('iframe.description')}
        </p>

        <IframeEmbedBuilder
          embedUrl={embedUrl}
          labels={{
            heightLabel: t('iframe.heightLabel'),
            previewLabel: t('iframe.previewLabel'),
            snippetLabel: t('iframe.snippetLabel'),
            copy: t('iframe.copy'),
            copied: t('iframe.copied'),
          }}
        />
      </section>
    </div>
  )
}
