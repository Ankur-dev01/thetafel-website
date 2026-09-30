'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from '@/i18n/routing'

type Role = 'owner' | 'manager' | 'service' | 'kitchen'
type InvRole = 'manager' | 'service' | 'kitchen'

export type MemberView = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  lastActive: string | null
  isSelf: boolean
  assignableRoles: InvRole[]
  canToggle: boolean
}

export type InviteView = {
  id: string
  email: string
  role: InvRole
  expires: string
  expired: boolean
  canRevoke: boolean
}

type Labels = {
  membersTitle: string
  invitesTitle: string
  inviteTitle: string
  emailLabel: string
  roleLabel: string
  sendInvite: string
  sending: string
  inviteSent: string
  inviteSentNoEmail: string
  active: string
  deactivated: string
  you: string
  lastActive: string
  never: string
  expiresOn: string
  expired: string
  deactivate: string
  reactivate: string
  revoke: string
  resend: string
  noInvites: string
  roleChangeLabel: string
  roles: Record<Role, string>
  errors: Record<string, string>
}

type Props = { members: MemberView[]; invites: InviteView[]; invitableRoles: InvRole[]; labels: Labels }

const fontLabel = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const fontBody = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const fontMuted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

const pill =
  'tafel-tap px-3 py-1.5 rounded-full text-[11px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50'

async function post(url: string, body: unknown): Promise<{ ok: boolean; code?: string; emailSent?: boolean }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = (await res.json()) as { ok?: boolean; code?: string; emailSent?: boolean }
    return { ok: res.ok && j.ok === true, code: j.code, emailSent: j.emailSent }
  } catch {
    return { ok: false, code: 'generic' }
  }
}

export default function StaffManager({ members, invites, invitableRoles, labels }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvRole>(invitableRoles[invitableRoles.length - 1] ?? 'service')
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const err = (code?: string) => labels.errors[code ?? ''] ?? labels.errors.generic

  async function run(key: string, url: string, body: unknown, okText?: string) {
    setBusy(key)
    setStatus(null)
    const r = await post(url, body)
    setBusy(null)
    if (r.ok) {
      if (okText) setStatus({ kind: 'ok', text: okText })
      router.refresh()
    } else {
      setStatus({ kind: 'error', text: err(r.code) })
    }
    return r
  }

  async function invite(e: FormEvent) {
    e.preventDefault()
    const r = await run('invite', '/api/dashboard/staff/invite', { email, role })
    if (r.ok) {
      setEmail('')
      setStatus({ kind: 'ok', text: r.emailSent === false ? labels.inviteSentNoEmail : labels.inviteSent })
    }
  }

  return (
    <div>
      {status && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          data-testid="staff-status"
          className={`mt-4 text-[13px] ${status.kind === 'error' ? 'text-[#b3422f]' : 'text-[#2f6b3d]'}`}
          style={fontBody}
        >
          {status.text}
        </p>
      )}

      <section className="mt-6 bg-white rounded-card p-5" data-testid="staff-members">
        <h2 className="text-[15px] text-[#1e1508]" style={fontLabel}>{labels.membersTitle}</h2>
        <ul className="mt-3 divide-y divide-[#f0e8d6]">
          {members.map((m) => (
            <li key={m.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="staff-member" data-role={m.role}>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-[#1e1508]" style={fontLabel}>
                  {m.name}
                  {m.isSelf && <span className="ml-2 text-[12px] text-[#8c8577]" style={fontMuted}>({labels.you})</span>}
                </div>
                <div className="text-[12px] text-[#6f6353] truncate" style={fontMuted}>{m.email}</div>
                <div className="text-[12px] text-[#8c8577]" style={fontMuted}>
                  {labels.lastActive}: {m.lastActive ?? labels.never} · {m.active ? labels.active : labels.deactivated}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {m.assignableRoles.length > 0 ? (
                  <select
                    aria-label={labels.roleChangeLabel}
                    value={m.role}
                    disabled={busy !== null || !m.active}
                    onChange={(e) => run(`role-${m.id}`, '/api/dashboard/staff/member', { memberId: m.id, action: 'role', role: e.target.value })}
                    data-testid="staff-role-select"
                    className="rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-2 py-1.5 text-[13px] text-[#1e1508]"
                    style={fontBody}
                  >
                    {m.assignableRoles.map((r) => (
                      <option key={r} value={r}>{labels.roles[r]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[13px] text-[#1e1508]" style={fontBody} data-testid="staff-role-label">{labels.roles[m.role]}</span>
                )}
                {m.canToggle && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => run(`toggle-${m.id}`, '/api/dashboard/staff/member', { memberId: m.id, action: m.active ? 'deactivate' : 'reactivate' })}
                    data-testid={m.active ? 'staff-deactivate' : 'staff-reactivate'}
                    className={pill}
                    style={fontLabel}
                  >
                    {m.active ? labels.deactivate : labels.reactivate}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 bg-white rounded-card p-5" data-testid="staff-invites">
        <h2 className="text-[15px] text-[#1e1508]" style={fontLabel}>{labels.invitesTitle}</h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-[13px] text-[#6f6353]" style={fontMuted}>{labels.noInvites}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#f0e8d6]">
            {invites.map((i) => (
              <li key={i.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="staff-invite">
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-[#1e1508] truncate" style={fontBody}>{i.email}</div>
                  <div className="text-[12px] text-[#8c8577]" style={fontMuted}>
                    {labels.roles[i.role]} · {i.expired ? labels.expired : labels.expiresOn.replace('{date}', i.expires)}
                  </div>
                </div>
                {i.canRevoke && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => run(`resend-${i.id}`, '/api/dashboard/staff/invite', { email: i.email, role: i.role }, labels.inviteSent)}
                      data-testid="staff-resend"
                      className={pill}
                      style={fontLabel}
                    >
                      {labels.resend}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => run(`revoke-${i.id}`, '/api/dashboard/staff/invite/revoke', { inviteId: i.id })}
                      data-testid="staff-revoke"
                      className={pill}
                      style={fontLabel}
                    >
                      {labels.revoke}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {invitableRoles.length > 0 && (
        <section className="mt-4 bg-white rounded-card p-5" data-testid="staff-invite-form">
          <h2 className="text-[15px] text-[#1e1508]" style={fontLabel}>{labels.inviteTitle}</h2>
          <form onSubmit={invite} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <label className="block flex-1">
              <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>{labels.emailLabel}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="staff-invite-email"
                className="w-full rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2.5 text-[14px] text-[#1e1508] outline-none focus:border-amber"
                style={fontBody}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>{labels.roleLabel}</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InvRole)}
                data-testid="staff-invite-role"
                className="rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2.5 text-[14px] text-[#1e1508]"
                style={fontBody}
              >
                {invitableRoles.map((r) => (
                  <option key={r} value={r}>{labels.roles[r]}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy !== null || email.trim() === ''}
              data-testid="staff-invite-send"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={fontLabel}
            >
              {busy === 'invite' ? labels.sending : labels.sendInvite}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
