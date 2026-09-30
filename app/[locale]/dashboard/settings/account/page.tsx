import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import AccountSettings from './AccountSettings'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

// Open to every staff role — each member edits only their own account.
export default async function AccountSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const t = await getTranslations({ locale, namespace: 'dashboard.settings.account' })

  const labelKeys = [
    'nameTitle', 'nameLabel', 'nameInvalid',
    'emailTitle', 'currentEmail', 'newEmailLabel', 'emailInvalid', 'emailSame', 'emailSent',
    'emailFailed', 'emailBusinessNote', 'emailBusinessLink',
    'passwordTitle', 'currentPasswordLabel', 'newPasswordLabel', 'confirmPasswordLabel',
    'passwordTooShort', 'passwordMismatch', 'passwordWrong', 'passwordSame', 'passwordWeak',
    'passwordChanged',
    'languageTitle', 'languageNl', 'languageEn',
    'signOutTitle', 'signOutDescription', 'signOutButton', 'signOutConfirmTitle',
    'signOutConfirmBody', 'signOutConfirm',
    'cancel', 'save', 'saving', 'saved', 'genericError', 'rateLimited',
  ] as const
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(k)])) as Record<
    (typeof labelKeys)[number],
    string
  >

  return (
    <div className="max-w-[640px] pb-12">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        &larr; {t('back')}
      </Link>

      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <AccountSettings
        locale={locale}
        initialName={context.staff.display_name}
        email={context.userEmail ?? ''}
        language={context.staff.language}
        businessHref={locale === 'en' ? '/en/dashboard/settings/business' : '/dashboard/settings/business'}
        labels={labels}
      />
    </div>
  )
}
