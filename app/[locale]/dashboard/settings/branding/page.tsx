import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { can } from '@/lib/dashboard/permissions'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import BrandingForm from './BrandingForm'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function BrandingSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Owner-only surface, same escape as BTW-2's business page — every
  // knob here is a public-facing identity change, not a day-to-day op.
  if (!can(context.staff.role, 'settings.branding.edit')) {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const r = context.restaurant

  // resolveDashboardContext already does select('*') on restaurants via
  // the RLS session client, so brand_primary_hex / qr_widget_accent_color /
  // brand_logo_url / hero_image_url are already on context.restaurant — no
  // second query needed (matches BTW-2's actual shipped pattern, not a
  // separate admin-client read).
  //
  // The resolved primary color is what the consumer surfaces actually
  // render — prefer brand_primary_hex, fall back to qr_widget_accent_color,
  // fall back to platform amber. Matches resolveBrandTokens' Phase-2 →
  // Phase-1 → fallback chain exactly.
  const resolvedPrimaryHex = r.brand_primary_hex ?? r.qr_widget_accent_color ?? '#d4820a'

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.branding' })

  return (
    <div className="max-w-[640px]">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        &larr; {t('back')}
      </Link>

      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <BrandingForm
        initial={{
          primaryHex: resolvedPrimaryHex,
          logoUrl: r.brand_logo_url,
          heroUrl: r.hero_image_url,
        }}
        labels={{
          colorSectionTitle: t('colorSectionTitle'),
          colorSectionDescription: t('colorSectionDescription'),
          colorPresetLabel: t('colorPresetLabel'),
          colorCustomLabel: t('colorCustomLabel'),
          colorPreviewLabel: t('colorPreviewLabel'),
          colorContrastWarning: t('colorContrastWarning'),
          logoSectionTitle: t('logoSectionTitle'),
          logoSectionDescription: t('logoSectionDescription'),
          logoNoneSet: t('logoNoneSet'),
          logoUploadLabel: t('logoUploadLabel'),
          logoUploading: t('logoUploading'),
          logoUploadError: t('logoUploadError'),
          logoRemoveLabel: t('logoRemoveLabel'),
          logoRemoveConfirm: t('logoRemoveConfirm'),
          heroSectionTitle: t('heroSectionTitle'),
          heroSectionDescription: t('heroSectionDescription'),
          heroNoneSet: t('heroNoneSet'),
          heroUploadLabel: t('heroUploadLabel'),
          heroUploading: t('heroUploading'),
          heroUploadError: t('heroUploadError'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          saveError: t('saveError'),
        }}
      />
    </div>
  )
}
