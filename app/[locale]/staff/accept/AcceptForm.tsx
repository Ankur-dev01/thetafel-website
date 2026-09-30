'use client'

import { useState, type FormEvent } from 'react'
import { validateDisplayName, validateNewPassword } from '@/lib/dashboard/account/accountValidation'

type Labels = {
  name: string
  password: string
  confirmPassword: string
  submit: string
  working: string
  nameInvalid: string
  passwordShort: string
  passwordMismatch: string
  errors: Record<string, string>
}

type Props = {
  token: string
  locale: 'nl' | 'en'
  email: string
  needsPassword: boolean
  labels: Labels
}

const fontLabel = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const fontBody = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const

export default function AcceptForm({ token, locale, email, needsPassword, labels }: Props) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!validateDisplayName(name).ok) return setError(labels.nameInvalid)
    if (needsPassword) {
      if (!validateNewPassword(password).ok) return setError(labels.passwordShort)
      if (password !== confirm) return setError(labels.passwordMismatch)
    }

    setBusy(true)
    try {
      const res = await fetch('/api/staff/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, locale, ...(needsPassword ? { password } : {}) }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string; destination?: string; createdAccount?: boolean }
      if (!res.ok || !data.ok) {
        setError(labels.errors[data.code ?? ''] ?? labels.errors.generic)
        setBusy(false)
        return
      }
      if (data.createdAccount) {
        // The account was just created with this password: sign in, then go.
        const login = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!login.ok) {
          window.location.assign(locale === 'en' ? '/en/login' : '/login')
          return
        }
      }
      window.location.assign(`${locale === 'en' ? '/en' : ''}${data.destination ?? '/dashboard'}`)
    } catch {
      setError(labels.errors.generic)
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2.5 text-[14px] text-[#1e1508] outline-none focus:border-amber'

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-3" noValidate data-testid="accept-form">
      <label className="block">
        <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>{labels.name}</span>
        <input className={input} style={fontBody} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" data-testid="accept-name" />
      </label>
      {needsPassword && (
        <>
          <label className="block">
            <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>{labels.password}</span>
            <input className={input} style={fontBody} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" data-testid="accept-password" />
          </label>
          <label className="block">
            <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>{labels.confirmPassword}</span>
            <input className={input} style={fontBody} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" data-testid="accept-confirm" />
          </label>
        </>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-[#b3422f]" style={fontBody} data-testid="accept-error">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy}
          data-testid="accept-submit"
          className="tafel-tap px-5 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={fontLabel}
        >
          {busy ? labels.working : labels.submit}
        </button>
      </div>
    </form>
  )
}
