import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { can } from '@/lib/dashboard/permissions'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import {
  assignableRolesFor,
  canRevokeInvite,
  canToggleActive,
  invitableRolesFor,
} from '@/lib/dashboard/staff/rolePolicy'
import { inviteStatus } from '@/lib/dashboard/staff/invites'
import StaffManager, { type MemberView, type InviteView } from './StaffManager'

export const dynamic = 'force-dynamic'

type Params = { locale: string }

export default async function StaffSettingsPage({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  const context = await resolveDashboardContext(locale)
  const actorRole = context.staff.role
  if (!can(actorRole, 'settings.staff.invite')) {
    redirect(locale === 'en' ? '/en/dashboard/settings' : '/dashboard/settings')
  }

  const admin = await createSupabaseServerClientAdmin()
  const restaurantId = context.restaurant.id
  const [{ data: staffRows }, { data: inviteRows }] = await Promise.all([
    admin
      .from('restaurant_staff')
      .select('id, user_id, role, display_name, deactivated_at, last_active_at, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true }),
    admin
      .from('staff_invites')
      .select('id, email_lower, role, expires_at, accepted_at, revoked_at')
      .eq('restaurant_id', restaurantId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
  ])

  const userIds = (staffRows ?? []).map((s) => s.user_id as string)
  const { data: profiles } = userIds.length
    ? await admin.from('profiles').select('id, email').in('id', userIds)
    : { data: [] as { id: string; email: string }[] }
  const emailByUser = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string]))

  const dt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const dateOnly = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const members: MemberView[] = (staffRows ?? []).map((s) => {
    const target = { role: s.role as MemberView['role'], isSelf: s.id === context.staff.id }
    return {
      id: s.id as string,
      name: s.display_name as string,
      email: emailByUser.get(s.user_id as string) ?? '',
      role: target.role,
      active: s.deactivated_at === null,
      lastActive: s.last_active_at ? dt.format(new Date(s.last_active_at as string)) : null,
      isSelf: target.isSelf,
      assignableRoles: [...assignableRolesFor(actorRole, target)],
      canToggle: canToggleActive(actorRole, target),
    }
  })

  const invites: InviteView[] = (inviteRows ?? []).map((i) => ({
    id: i.id as string,
    email: i.email_lower as string,
    role: i.role as InviteView['role'],
    expires: dateOnly.format(new Date(i.expires_at as string)),
    expired: inviteStatus({ expires_at: i.expires_at as string, accepted_at: null, revoked_at: null }) === 'expired',
    canRevoke: canRevokeInvite(actorRole, i.role as InviteView['role']),
  }))

  const t = await getTranslations({ locale, namespace: 'dashboard.settings.staff' })
  const errorKeys = [
    'invalid_email', 'invalid_role', 'role_not_allowed', 'already_member', 'rate_limited',
    'not_found', 'already_deactivated', 'already_active', 'not_pending', 'generic',
  ] as const
  const errors = Object.fromEntries(errorKeys.map((k) => [k, t(`errors.${k}`)]))

  return (
    <div className="max-w-[720px] pb-12">
      <Link
        href="/dashboard/settings"
        className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        &larr; {t('back')}
      </Link>
      <SectionHeader title={t('title')} subtitle={t('subtitle')} />

      <StaffManager
        members={members}
        invites={invites}
        invitableRoles={[...invitableRolesFor(actorRole)]}
        labels={{
          membersTitle: t('membersTitle'),
          invitesTitle: t('invitesTitle'),
          inviteTitle: t('inviteTitle'),
          emailLabel: t('emailLabel'),
          roleLabel: t('roleLabel'),
          sendInvite: t('sendInvite'),
          sending: t('sending'),
          inviteSent: t('inviteSent'),
          inviteSentNoEmail: t('inviteSentNoEmail'),
          active: t('active'),
          deactivated: t('deactivated'),
          you: t('you'),
          lastActive: t('lastActive'),
          never: t('never'),
          expiresOn: t.raw('expiresOn') as string,
          expired: t('expired'),
          deactivate: t('deactivate'),
          reactivate: t('reactivate'),
          revoke: t('revoke'),
          resend: t('resend'),
          noInvites: t('noInvites'),
          roleChangeLabel: t('roleChangeLabel'),
          roles: {
            owner: t('roles.owner'),
            manager: t('roles.manager'),
            service: t('roles.service'),
            kitchen: t('roles.kitchen'),
          },
          errors,
        }}
      />
    </div>
  )
}
