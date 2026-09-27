import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import BusinessForm from './BusinessForm'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function BusinessSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)

  // Owner-only surface — every field here is legal or commercial
  // identity; managers don't get write access. resolveDashboardContext
  // itself doesn't gate by role (hours/floor/etc. are open to managers
  // too), so this page enforces it directly, matching the redirect
  // style resolveDashboardContext already uses for its own gates.
  if (context.staff.role !== 'owner') {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const r = context.restaurant
  const t = await getTranslations({ locale, namespace: 'dashboard.settings.business' })

  const legalAddress =
    [
      [r.legal_address_street, r.legal_address_house_number, r.legal_address_house_letter, r.legal_address_house_number_addition]
        .filter(Boolean)
        .join(' '),
      [r.legal_address_postcode, r.legal_address_city].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ') || '—'

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

      <BusinessForm
        initial={{
          display_name: r.display_name ?? '',
          trade_name: r.trade_name ?? '',
          btw_number: r.btw_number ?? '',
          contact_phone: r.contact_phone ?? '',
          contact_email: r.contact_email ?? '',
          website: r.website ?? '',
          cuisine_type: r.cuisine_type ?? '',
        }}
        readOnly={{
          kvk_number: r.kvk_number ?? '—',
          legal_name: r.legal_name ?? '—',
          legal_form: r.legal_form ?? '—',
          sbi_code: r.sbi_code ?? '—',
          legal_address: legalAddress,
        }}
        labels={{
          identitySection: t('identitySection'),
          taxSection: t('taxSection'),
          contactSection: t('contactSection'),
          kvkLabel: t('kvkLabel'),
          legalNameLabel: t('legalNameLabel'),
          legalFormLabel: t('legalFormLabel'),
          sbiCodeLabel: t('sbiCodeLabel'),
          legalAddressLabel: t('legalAddressLabel'),
          readOnlyNote: t('readOnlyNote'),
          supportEmail: t('supportEmail'),
          displayNameLabel: t('displayNameLabel'),
          tradeNameLabel: t('tradeNameLabel'),
          btwLabel: t('btwLabel'),
          btwPlaceholder: t('btwPlaceholder'),
          btwInvalid: t('btwInvalid'),
          btwRequired: t('btwRequired'),
          btwLinked: t('btwLinked'),
          phoneLabel: t('phoneLabel'),
          phoneInvalid: t('phoneInvalid'),
          emailLabel: t('emailLabel'),
          emailInvalid: t('emailInvalid'),
          websiteLabel: t('websiteLabel'),
          websiteInvalid: t('websiteInvalid'),
          cuisineLabel: t('cuisineLabel'),
          save: t('save'),
          saving: t('saving'),
          saved: t('saved'),
          saveError: t('saveError'),
          cancel: t('cancel'),
        }}
      />
    </div>
  )
}
