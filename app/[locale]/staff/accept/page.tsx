import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { findInviteByToken, findUserIdByEmail, inviteStatus } from '@/lib/dashboard/staff/invites'
import AcceptForm from './AcceptForm'

export const dynamic = 'force-dynamic'

type Params = { locale: string }
type SearchParams = { token?: string }

const heading = { fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 } as const
const body = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const

export default async function StaffAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const { token = '' } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const t = await getTranslations({ locale, namespace: 'staffAccept' })

  const admin = await createSupabaseServerClientAdmin()
  const invite = await findInviteByToken(admin, token)
  const status = invite ? inviteStatus(invite) : 'invalid'

  let content: React.ReactNode
  if (!invite || status !== 'valid') {
    const key = !invite ? 'invalid' : status
    content = (
      <>
        <h1 className="text-[26px] text-[#1e1508]" style={heading}>
          {t(`problem.${key}.title`)}
        </h1>
        <p className="mt-2 text-[14px] text-[#6f6353]" style={body} data-testid="accept-problem">
          {t(`problem.${key}.body`)}
        </p>
      </>
    )
  } else {
    const { data: r } = await admin
      .from('restaurants')
      .select('display_name, legal_name, slug')
      .eq('id', invite.restaurant_id)
      .maybeSingle<{ display_name: string | null; legal_name: string | null; slug: string }>()
    const restaurantName = r?.display_name ?? r?.legal_name ?? r?.slug ?? 'The Tafel'

    const existingUserId = await findUserIdByEmail(admin, invite.email_lower)
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const mode: 'create' | 'login_required' | 'wrong_account' | 'confirm' = !existingUserId
      ? 'create'
      : !user
        ? 'login_required'
        : user.id === existingUserId
          ? 'confirm'
          : 'wrong_account'

    content = (
      <>
        <h1 className="text-[26px] text-[#1e1508]" style={heading}>
          {t('title', { restaurant: restaurantName })}
        </h1>
        <p className="mt-2 text-[14px] text-[#6f6353]" style={body}>
          {t('intro', { role: t(`roles.${invite.role}`), email: invite.email_lower })}
        </p>
        {mode === 'login_required' && (
          <div className="mt-5" data-testid="accept-login-required">
            <p className="text-[14px] text-[#1e1508]" style={body}>
              {t('loginRequired', { email: invite.email_lower })}
            </p>
            <Link
              href="/login"
              className="tafel-tap inline-block mt-4 px-5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
              style={{ ...body, fontWeight: 600 }}
            >
              {t('loginCta')}
            </Link>
          </div>
        )}
        {mode === 'wrong_account' && (
          <p className="mt-5 text-[14px] text-[#b3422f]" style={body} data-testid="accept-wrong-account">
            {t('wrongAccount', { email: invite.email_lower })}
          </p>
        )}
        {(mode === 'create' || mode === 'confirm') && (
          <AcceptForm
            token={token}
            locale={locale}
            email={invite.email_lower}
            needsPassword={mode === 'create'}
            labels={{
              name: t('form.name'),
              password: t('form.password'),
              confirmPassword: t('form.confirmPassword'),
              submit: mode === 'create' ? t('form.create') : t('form.accept'),
              working: t('form.working'),
              nameInvalid: t('errors.nameInvalid'),
              passwordShort: t('errors.passwordShort'),
              passwordMismatch: t('errors.passwordMismatch'),
              errors: {
                invalid_token: t('problem.invalid.body'),
                invite_expired: t('problem.expired.body'),
                invite_accepted: t('problem.accepted.body'),
                invite_revoked: t('problem.revoked.body'),
                login_required: t('errors.loginRequired'),
                wrong_account: t('errors.wrongAccount'),
                already_staff_elsewhere: t('errors.elsewhere'),
                already_member: t('errors.alreadyMember'),
                weak_password: t('errors.weakPassword'),
                rate_limited: t('errors.rateLimited'),
                generic: t('errors.generic'),
              },
            }}
          />
        )}
      </>
    )
  }

  return (
    <main className="min-h-screen bg-cream flex items-start justify-center px-5 py-16">
      <div className="w-full max-w-[440px] bg-white rounded-card p-6" data-testid="staff-accept">
        {content}
      </div>
    </main>
  )
}
