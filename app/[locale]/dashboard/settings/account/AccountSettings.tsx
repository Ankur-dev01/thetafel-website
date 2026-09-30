'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter, usePathname } from '@/i18n/routing'
import {
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
  validateAccountEmail,
  validateDisplayName,
  validateNewPassword,
} from '@/lib/dashboard/account/accountValidation'

type Locale = 'nl' | 'en'

type Labels = {
  nameTitle: string
  nameLabel: string
  nameInvalid: string
  emailTitle: string
  currentEmail: string
  newEmailLabel: string
  emailInvalid: string
  emailSame: string
  emailSent: string
  emailFailed: string
  emailBusinessNote: string
  emailBusinessLink: string
  passwordTitle: string
  currentPasswordLabel: string
  newPasswordLabel: string
  confirmPasswordLabel: string
  passwordTooShort: string
  passwordMismatch: string
  passwordWrong: string
  passwordSame: string
  passwordWeak: string
  passwordChanged: string
  languageTitle: string
  languageNl: string
  languageEn: string
  signOutTitle: string
  signOutDescription: string
  signOutButton: string
  signOutConfirmTitle: string
  signOutConfirmBody: string
  signOutConfirm: string
  cancel: string
  save: string
  saving: string
  saved: string
  genericError: string
  rateLimited: string
}

type Props = {
  locale: Locale
  initialName: string
  email: string
  language: Locale
  businessHref: string
  labels: Labels
}

const fontLabel = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const fontBody = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const fontMuted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; code?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    let code: string | undefined
    try {
      code = ((await res.json()) as { code?: string }).code
    } catch {
      // non-JSON body
    }
    return { ok: res.ok, status: res.status, code }
  } catch {
    return { ok: false, status: 0, code: 'network' }
  }
}

function Card({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section className="mt-4 bg-white rounded-card p-5" data-testid={testId}>
      <h2 className="text-[15px] text-[#1e1508]" style={fontLabel}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  testId,
  value,
  onChange,
  type = 'text',
  maxLength,
  autoComplete,
  error,
}: {
  label: string
  testId: string
  value: string
  onChange: (v: string) => void
  type?: string
  maxLength?: number
  autoComplete?: string
  error?: string | null
}) {
  return (
    <label className="block">
      <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        autoComplete={autoComplete}
        data-testid={testId}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2.5 text-[14px] text-[#1e1508] outline-none focus:border-amber"
        style={fontBody}
      />
      {error && (
        <span className="block mt-1 text-[12px] text-[#b3422f]" style={fontBody} role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

function SaveButton({
  testId,
  busy,
  disabled,
  label,
  busyLabel,
}: {
  testId: string
  busy: boolean
  disabled: boolean
  label: string
  busyLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      data-testid={testId}
      className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
      style={fontLabel}
    >
      {busy ? busyLabel : label}
    </button>
  )
}

function StatusLine({ status, testId }: { status: Status; testId: string }) {
  if (status.kind === 'idle') return null
  return (
    <p
      role={status.kind === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={`mt-3 text-[13px] ${status.kind === 'error' ? 'text-[#b3422f]' : 'text-[#2f6b3d]'}`}
      style={fontBody}
    >
      {status.message}
    </p>
  )
}

export default function AccountSettings({ locale, initialName, email, language, businessHref, labels }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // ---- Name ----
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameStatus, setNameStatus] = useState<Status>({ kind: 'idle' })
  const nameCheck = validateDisplayName(name)

  async function submitName(e: FormEvent) {
    e.preventDefault()
    if (!nameCheck.ok) return
    setNameBusy(true)
    setNameStatus({ kind: 'idle' })
    const res = await postJson('/api/dashboard/account/name', { displayName: nameCheck.value })
    setNameBusy(false)
    if (res.ok) {
      setSavedName(nameCheck.value)
      setName(nameCheck.value)
      setNameStatus({ kind: 'ok', message: labels.saved })
      router.refresh()
    } else {
      setNameStatus({ kind: 'error', message: res.status === 429 ? labels.rateLimited : labels.genericError })
    }
  }

  // ---- Email ----
  const [newEmail, setNewEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState<Status>({ kind: 'idle' })
  const emailCheck = validateAccountEmail(newEmail)
  const emailSame = emailCheck.ok && emailCheck.value === email.toLowerCase()
  const emailFieldError =
    emailTouched && newEmail.trim() !== ''
      ? !emailCheck.ok
        ? labels.emailInvalid
        : emailSame
          ? labels.emailSame
          : null
      : null

  async function submitEmail(e: FormEvent) {
    e.preventDefault()
    setEmailTouched(true)
    setEmailStatus({ kind: 'idle' })
    if (!emailCheck.ok) {
      setEmailStatus({ kind: 'error', message: labels.emailInvalid })
      return
    }
    if (emailSame) {
      setEmailStatus({ kind: 'error', message: labels.emailSame })
      return
    }
    setEmailBusy(true)
    const res = await postJson('/api/dashboard/account/email', { email: emailCheck.value })
    setEmailBusy(false)
    if (res.ok) {
      setEmailStatus({ kind: 'ok', message: labels.emailSent })
      setNewEmail('')
      setEmailTouched(false)
    } else {
      setEmailStatus({
        kind: 'error',
        message:
          res.status === 429
            ? labels.rateLimited
            : res.code === 'invalid_email'
              ? labels.emailInvalid
              : labels.emailFailed,
      })
    }
  }

  // ---- Password ----
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwTouched, setPwTouched] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwStatus, setPwStatus] = useState<Status>({ kind: 'idle' })
  const newPwCheck = validateNewPassword(newPw)
  const newPwError = pwTouched && newPw !== '' && !newPwCheck.ok ? labels.passwordTooShort : null
  const confirmError = pwTouched && confirmPw !== '' && confirmPw !== newPw ? labels.passwordMismatch : null

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    setPwTouched(true)
    setPwStatus({ kind: 'idle' })
    if (!currentPw) {
      setPwStatus({ kind: 'error', message: labels.passwordWrong })
      return
    }
    if (!newPwCheck.ok) {
      setPwStatus({ kind: 'error', message: labels.passwordTooShort })
      return
    }
    if (newPw !== confirmPw) {
      setPwStatus({ kind: 'error', message: labels.passwordMismatch })
      return
    }
    setPwBusy(true)
    const res = await postJson('/api/dashboard/account/password', {
      currentPassword: currentPw,
      newPassword: newPw,
    })
    setPwBusy(false)
    if (res.ok) {
      setPwStatus({ kind: 'ok', message: labels.passwordChanged })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwTouched(false)
      return
    }
    const message =
      res.status === 429
        ? labels.rateLimited
        : res.code === 'wrong_password'
          ? labels.passwordWrong
          : res.code === 'same_password'
            ? labels.passwordSame
            : res.code === 'weak_password'
              ? labels.passwordWeak
              : res.code === 'password_too_short'
                ? labels.passwordTooShort
                : labels.genericError
    setPwStatus({ kind: 'error', message })
  }

  // ---- Language ----
  const [langBusy, setLangBusy] = useState<Locale | null>(null)
  const [langStatus, setLangStatus] = useState<Status>({ kind: 'idle' })

  async function chooseLanguage(target: Locale) {
    if ((target === language && target === locale) || langBusy) return
    setLangBusy(target)
    setLangStatus({ kind: 'idle' })
    const res = await postJson('/api/dashboard/account/language', { locale: target })
    if (res.ok) {
      // Same page, other locale (/dashboard/settings/account ↔ /en/…).
      router.replace(pathname, { locale: target })
      return
    }
    setLangBusy(null)
    setLangStatus({ kind: 'error', message: labels.genericError })
  }

  // ---- Sign out everywhere ----
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutStatus, setSignOutStatus] = useState<Status>({ kind: 'idle' })

  async function signOutEverywhere() {
    setSignOutBusy(true)
    setSignOutStatus({ kind: 'idle' })
    const res = await postJson('/api/dashboard/account/signout-all', {})
    if (res.ok) {
      window.location.assign(locale === 'en' ? '/en/login' : '/login')
      return
    }
    setSignOutBusy(false)
    setConfirmOpen(false)
    setSignOutStatus({ kind: 'error', message: labels.genericError })
  }

  return (
    <div>
      <Card title={labels.nameTitle} testId="account-name-card">
        <form onSubmit={submitName} className="flex flex-col gap-3" noValidate>
          <Field
            label={labels.nameLabel}
            testId="account-name"
            value={name}
            onChange={(v) => {
              setName(v)
              setNameStatus({ kind: 'idle' })
            }}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="name"
            error={name !== savedName && !nameCheck.ok ? labels.nameInvalid : null}
          />
          <div>
            <SaveButton
              testId="account-name-save"
              busy={nameBusy}
              disabled={!nameCheck.ok || name.trim() === savedName}
              label={labels.save}
              busyLabel={labels.saving}
            />
          </div>
        </form>
        <StatusLine status={nameStatus} testId="account-name-status" />
      </Card>

      <Card title={labels.emailTitle} testId="account-email-card">
        <p className="text-[13px] text-[#6f6353]" style={fontMuted}>
          {labels.currentEmail}{' '}
          <strong className="text-[#1e1508]" style={fontLabel} data-testid="account-current-email">
            {email}
          </strong>
        </p>
        <form onSubmit={submitEmail} className="mt-3 flex flex-col gap-3" noValidate>
          <Field
            label={labels.newEmailLabel}
            testId="account-new-email"
            type="email"
            value={newEmail}
            onChange={(v) => {
              setNewEmail(v)
              setEmailStatus({ kind: 'idle' })
            }}
            autoComplete="email"
            error={emailFieldError}
          />
          <div>
            <SaveButton
              testId="account-email-save"
              busy={emailBusy}
              disabled={newEmail.trim() === ''}
              label={labels.save}
              busyLabel={labels.saving}
            />
          </div>
        </form>
        <StatusLine status={emailStatus} testId="account-email-status" />
        <p className="mt-3 text-[12px] text-[#6f6353] leading-relaxed" style={fontMuted}>
          {labels.emailBusinessNote}{' '}
          <a href={businessHref} className="text-amber underline underline-offset-2">
            {labels.emailBusinessLink}
          </a>
        </p>
      </Card>

      <Card title={labels.passwordTitle} testId="account-password-card">
        <form onSubmit={submitPassword} className="flex flex-col gap-3" noValidate>
          <Field
            label={labels.currentPasswordLabel}
            testId="account-current-password"
            type="password"
            value={currentPw}
            onChange={(v) => {
              setCurrentPw(v)
              setPwStatus({ kind: 'idle' })
            }}
            autoComplete="current-password"
          />
          <Field
            label={labels.newPasswordLabel}
            testId="account-new-password"
            type="password"
            value={newPw}
            onChange={(v) => {
              setNewPw(v)
              setPwStatus({ kind: 'idle' })
            }}
            autoComplete="new-password"
            error={newPwError}
          />
          <Field
            label={labels.confirmPasswordLabel}
            testId="account-confirm-password"
            type="password"
            value={confirmPw}
            onChange={(v) => {
              setConfirmPw(v)
              setPwStatus({ kind: 'idle' })
            }}
            autoComplete="new-password"
            error={confirmError}
          />
          <div>
            <SaveButton
              testId="account-password-save"
              busy={pwBusy}
              disabled={!currentPw || newPw.length < PASSWORD_MIN || confirmPw === ''}
              label={labels.save}
              busyLabel={labels.saving}
            />
          </div>
        </form>
        <StatusLine status={pwStatus} testId="account-password-status" />
      </Card>

      <Card title={labels.languageTitle} testId="account-language-card">
        <div className="flex gap-2">
          {(['nl', 'en'] as const).map((option) => {
            const active = option === language
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseLanguage(option)}
                disabled={langBusy !== null}
                aria-pressed={active}
                data-testid={`account-language-${option}`}
                className={
                  'tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] disabled:opacity-60 ' +
                  (active ? 'bg-amber text-[#1e1508]' : 'bg-[#f5ede0] text-[#1e1508]')
                }
                style={fontLabel}
              >
                {option === 'nl' ? labels.languageNl : labels.languageEn}
              </button>
            )
          })}
        </div>
        <StatusLine status={langStatus} testId="account-language-status" />
      </Card>

      <Card title={labels.signOutTitle} testId="account-signout-card">
        <p className="text-[13px] text-[#6f6353] leading-relaxed" style={fontMuted}>
          {labels.signOutDescription}
        </p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          data-testid="account-signout-all"
          className="tafel-tap mt-3 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
          style={fontLabel}
        >
          {labels.signOutButton}
        </button>
        <StatusLine status={signOutStatus} testId="account-signout-status" />
      </Card>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(30,21,8,0.45)] px-5"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !signOutBusy) setConfirmOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-confirm-title"
            data-testid="account-signout-dialog"
            className="w-full max-w-[360px] rounded-card bg-white p-5"
          >
            <h3 id="signout-confirm-title" className="text-[16px] text-[#1e1508]" style={fontLabel}>
              {labels.signOutConfirmTitle}
            </h3>
            <p className="mt-2 text-[13px] text-[#6f6353] leading-relaxed" style={fontBody}>
              {labels.signOutConfirmBody}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmOpen(false)}
                disabled={signOutBusy}
                data-testid="account-signout-cancel"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
                style={fontLabel}
              >
                {labels.cancel}
              </button>
              <button
                type="button"
                onClick={signOutEverywhere}
                disabled={signOutBusy}
                data-testid="account-signout-confirm"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={fontLabel}
              >
                {signOutBusy ? labels.saving : labels.signOutConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
