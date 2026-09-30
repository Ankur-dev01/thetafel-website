'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'

type Labels = {
  button: string
  title: string
  statement: string
  reasonLegend: string
  reasons: Record<'too_expensive' | 'missing_features' | 'closing_or_pausing' | 'switching_provider' | 'other', string>
  detailsLabel: string
  detailsRequired: string
  reasonRequired: string
  confirm: string
  working: string
  keep: string
  errorGeneric: string
  errorMollie: string
  errorAlready: string
}

const REASONS = ['too_expensive', 'missing_features', 'closing_or_pausing', 'switching_provider', 'other'] as const
type Reason = (typeof REASONS)[number]

const fontLabel = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const fontBody = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const

export default function CancelSubscription({ labels }: { labels: Labels }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [details, setDetails] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validationError = !reason
    ? labels.reasonRequired
    : reason === 'other' && details.trim() === ''
      ? labels.detailsRequired
      : null

  function close() {
    if (busy) return
    setOpen(false)
    setError(null)
    setTouched(false)
  }

  async function confirm() {
    setTouched(true)
    if (validationError || !reason) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() }),
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
        return
      }
      let code = ''
      try {
        code = ((await res.json()) as { code?: string }).code ?? ''
      } catch {
        // ignore
      }
      setError(
        code === 'mollie_failed'
          ? labels.errorMollie
          : code === 'already_cancelled'
            ? labels.errorAlready
            : labels.errorGeneric,
      )
    } catch {
      setError(labels.errorGeneric)
    }
    setBusy(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="billing-cancel-open"
        className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
        style={fontLabel}
      >
        {labels.button}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(30,21,8,0.45)] px-5"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-sub-title"
            data-testid="billing-cancel-dialog"
            className="w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-card bg-white p-5"
          >
            <h3 id="cancel-sub-title" className="text-[16px] text-[#1e1508]" style={fontLabel}>
              {labels.title}
            </h3>
            <p className="mt-2 text-[13px] text-[#1e1508] leading-relaxed" style={fontBody} data-testid="billing-cancel-statement">
              {labels.statement}
            </p>

            <fieldset className="mt-4">
              <legend className="text-[12px] text-[#6f6353] mb-2" style={fontLabel}>
                {labels.reasonLegend}
              </legend>
              <div className="flex flex-col gap-2">
                {REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-[14px] text-[#1e1508]" style={fontBody}>
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      data-testid={`billing-cancel-reason-${r}`}
                    />
                    {labels.reasons[r]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block mt-3">
              <span className="block text-[12px] text-[#6f6353] mb-1" style={fontLabel}>
                {labels.detailsLabel}
              </span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                data-testid="billing-cancel-details"
                className="w-full rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2 text-[14px] text-[#1e1508] outline-none focus:border-amber"
                style={fontBody}
              />
            </label>

            {touched && validationError && (
              <p role="alert" className="mt-2 text-[12px] text-[#b3422f]" style={fontBody} data-testid="billing-cancel-validation">
                {validationError}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[13px] text-[#b3422f]" style={fontBody} data-testid="billing-cancel-error">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={close}
                disabled={busy}
                data-testid="billing-cancel-keep"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
                style={fontLabel}
              >
                {labels.keep}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                data-testid="billing-cancel-confirm"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={fontLabel}
              >
                {busy ? labels.working : labels.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
