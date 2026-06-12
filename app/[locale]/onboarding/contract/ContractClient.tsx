'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'

// ── Types ─────────────────────────────────────────────────────────────────

type ContractLocale = 'nl' | 'en'

interface Props {
  restaurantId: string
  restaurantLegalName: string
  pageLocale: ContractLocale
  contractNl: string
  hashNl: string
  contractEn: string
  hashEn: string
  nextStepUrl: string
  backHref: string
  currentDisplayNum: number
  totalSteps: number
}

// ── Minimal markdown renderer ─────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(
        <strong key={m.index} style={{ fontWeight: 700, color: '#1e1508' }}>
          {m[2]}
        </strong>
      )
    } else if (m[3]) {
      nodes.push(
        <code
          key={m.index}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.9em',
            background: 'rgba(30,21,8,0.06)',
            borderRadius: '3px',
            padding: '1px 4px',
          }}
        >
          {m[4]}
        </code>
      )
    }
    last = regex.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

type MdToken =
  | { t: 'h1'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'hr' }
  | { t: 'ul'; items: string[] }
  | { t: 'table'; headers: string[]; rows: string[][] }
  | { t: 'p'; text: string }

function tokenize(md: string): MdToken[] {
  const lines = md.split('\n')
  const tokens: MdToken[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (line.startsWith('# ')) {
      tokens.push({ t: 'h1', text: line.slice(2) })
      i++
      continue
    }
    if (line.startsWith('## ')) {
      tokens.push({ t: 'h2', text: line.slice(3) })
      i++
      continue
    }
    if (/^-{3,}$/.test(line.trim())) {
      tokens.push({ t: 'hr' })
      i++
      continue
    }
    if (line.startsWith('| ') || line.startsWith('|#') || line.startsWith('|-')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i]!.startsWith('|')) {
        tableLines.push(lines[i]!)
        i++
      }
      const parsed = tableLines
        .filter((l) => !/^\|[-| :]+\|$/.test(l.trim()))
        .map((l) =>
          l
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        )
      if (parsed.length > 0) {
        const [headers, ...rows] = parsed as [string[], ...string[][]]
        tokens.push({ t: 'table', headers, rows })
      }
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i]!.startsWith('- ')) {
        items.push(lines[i]!.slice(2))
        i++
      }
      tokens.push({ t: 'ul', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]!
      if (
        next.trim() === '' ||
        next.startsWith('# ') ||
        next.startsWith('## ') ||
        next.startsWith('- ') ||
        next.startsWith('|') ||
        /^-{3,}$/.test(next.trim())
      ) break
      paraLines.push(next)
      i++
    }
    tokens.push({ t: 'p', text: paraLines.join(' ') })
  }

  return tokens
}

function MinimalMarkdown({ content }: { content: string }) {
  const tokens = tokenize(content)

  return (
    <div
      style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '14px',
        lineHeight: '1.65',
        color: '#1e1508',
      }}
    >
      {tokens.map((tok, idx) => {
        if (tok.t === 'h1') {
          return (
            <h1
              key={idx}
              style={{
                fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                fontWeight: 900,
                fontSize: '18px',
                color: '#1e1508',
                margin: '20px 0 8px',
              }}
            >
              {renderInline(tok.text)}
            </h1>
          )
        }
        if (tok.t === 'h2') {
          return (
            <h2
              key={idx}
              style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 600,
                fontSize: '15px',
                color: '#1e1508',
                margin: '16px 0 6px',
              }}
            >
              {renderInline(tok.text)}
            </h2>
          )
        }
        if (tok.t === 'hr') {
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px solid rgba(30,21,8,0.1)',
                margin: '16px 0',
              }}
            />
          )
        }
        if (tok.t === 'ul') {
          return (
            <ul
              key={idx}
              style={{
                paddingLeft: '20px',
                margin: '8px 0',
                listStyle: 'disc',
              }}
            >
              {tok.items.map((item, ii) => (
                <li key={ii} style={{ marginBottom: '4px' }}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          )
        }
        if (tok.t === 'table') {
          return (
            <div key={idx} style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontSize: '12px',
                }}
              >
                <thead>
                  <tr>
                    {tok.headers.map((h, hi) => (
                      <th
                        key={hi}
                        style={{
                          padding: '6px 10px',
                          textAlign: 'left',
                          fontWeight: 600,
                          borderBottom: '1px solid rgba(30,21,8,0.15)',
                          color: '#1e1508',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tok.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '6px 10px',
                            borderBottom: '1px solid rgba(30,21,8,0.07)',
                            color: ci === 0 ? '#1e1508' : '#9c8b6a',
                            verticalAlign: 'top',
                          }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p
            key={idx}
            style={{ margin: '0 0 8px', color: '#1e1508' }}
          >
            {renderInline(tok.text)}
          </p>
        )
      })}
    </div>
  )
}

// ── Signature canvas ──────────────────────────────────────────────────────

interface SignatureCanvasHandle {
  clear: () => void
  restore: (url: string) => void
}

const SignatureCanvas = forwardRef<
  SignatureCanvasHandle,
  { onSign: (dataUrl: string) => void; onClear: () => void; locked: boolean }
>(function SignatureCanvas({ onSign, onClear, locked }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1e1508'
    }

    setupCanvas()
    window.addEventListener('resize', setupCanvas)
    return () => window.removeEventListener('resize', setupCanvas)
  }, [])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
    hasDrawnRef.current = false
    onClear()
  }

  useImperativeHandle(ref, () => ({
    clear: handleClear,
    restore(url: string) {
      const canvas = canvasRef.current
      if (!canvas) return
      const img = new window.Image()
      img.onload = () => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        ctx.drawImage(img, 0, 0, rect.width, rect.height)
        hasDrawnRef.current = true
      }
      img.src = url
    },
  }))

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const { x, y } = getPointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || locked) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasDrawnRef.current = true
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }
    if (hasDrawnRef.current) {
      onSign(canvas.toDataURL('image/png'))
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleClear}
        disabled={locked}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1,
          background: 'transparent',
          border: '1px solid rgba(30,21,8,0.2)',
          borderRadius: '6px',
          padding: '3px 10px',
          fontSize: '12px',
          color: '#9c8b6a',
          cursor: locked ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
        }}
      >
        ✕
      </button>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          display: 'block',
          width: '100%',
          height: '160px',
          borderRadius: '8px',
          border: locked
            ? '1.5px dashed rgba(30,21,8,0.2)'
            : '1.5px solid #d4820a',
          background: '#fff',
          cursor: locked ? 'not-allowed' : 'crosshair',
          touchAction: 'none',
        }}
      />
    </div>
  )
})

// ── Checkbox ──────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        cursor: 'pointer',
      }}
    >
      <span
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          border: checked
            ? '2px solid #d4820a'
            : '2px solid rgba(30,21,8,0.25)',
          background: checked ? '#d4820a' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === ' ' || e.key === 'Enter') && onChange(!checked)
        }
      >
        {checked && (
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="#fdfaf5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '13px',
          color: '#1e1508',
          lineHeight: '1.5',
        }}
      >
        {children}
      </span>
    </label>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function ContractClient({
  restaurantId,
  restaurantLegalName,
  pageLocale,
  contractNl,
  hashNl,
  contractEn,
  hashEn,
  nextStepUrl,
  backHref,
  currentDisplayNum,
  totalSteps,
}: Props) {
  const t = useTranslations('onboarding.contract')
  const router = useRouter()

  const [activeLocale, setActiveLocale] = useState<ContractLocale>(pageLocale)
  const [fullName, setFullName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contractChanged, setContractChanged] = useState(false)

  const signatureCanvasRef = useRef<SignatureCanvasHandle>(null)
  const STORAGE_KEY = `tafel-contract-draft-${restaurantId}-v1`

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as {
        fullName?: string
        signatureDataUrl?: string
        termsAccepted?: boolean
        authorityConfirmed?: boolean
      }
      if (typeof data.fullName === 'string') setFullName(data.fullName)
      if (typeof data.termsAccepted === 'boolean') setTermsAccepted(data.termsAccepted)
      if (typeof data.authorityConfirmed === 'boolean') setAuthorityConfirmed(data.authorityConfirmed)
      if (
        typeof data.signatureDataUrl === 'string' &&
        data.signatureDataUrl.startsWith('data:image/png;base64,')
      ) {
        setSignatureDataUrl(data.signatureDataUrl)
        signatureCanvasRef.current?.restore(data.signatureDataUrl)
      }
    } catch {
      // localStorage unavailable or corrupted — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist draft to localStorage on every field change
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fullName, signatureDataUrl, termsAccepted, authorityConfirmed })
      )
    } catch {
      // quota or unavailable — ignore
    }
  }, [fullName, signatureDataUrl, termsAccepted, authorityConfirmed, STORAGE_KEY])

  const activeContract = activeLocale === 'nl' ? contractNl : contractEn
  const activeHash = activeLocale === 'nl' ? hashNl : hashEn

  const termsHref = activeLocale === 'en' ? '/en/algemene-voorwaarden' : '/algemene-voorwaarden'
  const dpaHref = activeLocale === 'en' ? '/en/verwerkersovereenkomst' : '/verwerkersovereenkomst'

  function handleLocaleSwitch(locale: ContractLocale) {
    if (locale === activeLocale) return
    setActiveLocale(locale)
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    setContractChanged(false)
    try {
      const res = await fetch(
        `/api/v1/restaurants/${restaurantId}/contract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            signature_data_url: signatureDataUrl,
            authority_confirmed: true,
            locale_signed: activeLocale,
            contract_version: '1.0',
            document_hash: activeHash,
          }),
        }
      )

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}))
        if (body?.error === 'contract_changed') {
          setContractChanged(true)
          return
        }
      }

      if (!res.ok) {
        setError(t('errorGeneric'))
        return
      }

      try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
      router.push(nextStepUrl)
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const canContinue =
    fullName.trim().length >= 2 &&
    signatureDataUrl !== null &&
    termsAccepted &&
    authorityConfirmed &&
    !submitting

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontWeight: 500,
    fontSize: '13px',
    color: '#1e1508',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(30,21,8,0.2)',
    borderRadius: '8px',
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontSize: '14px',
    color: '#1e1508',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const linkStyle: React.CSSProperties = {
    color: '#d4820a',
    textDecoration: 'underline',
    fontWeight: 500,
  }

  return (
    <StepFrame
      locale={activeLocale}
      showProgress
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      heading={t('heading')}
      subHeading={t('subheading')}
      backHref={backHref}
      canContinue={canContinue}
      continueLabel={t('submitButton')}
      submittingLabel={t('submitting')}
      onContinue={handleSubmit}
      isSubmitting={submitting}
      error={error}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Language toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '12px',
              color: '#9c8b6a',
              fontWeight: 500,
            }}
          >
            {t('languageToggleLabel')}:
          </span>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: '999px',
              border: '1px solid rgba(30,21,8,0.15)',
              overflow: 'hidden',
            }}
          >
            {(['nl', 'en'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => handleLocaleSwitch(loc)}
                style={{
                  padding: '5px 14px',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: activeLocale === loc ? 600 : 400,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeLocale === loc ? '#1e1508' : 'transparent',
                  color: activeLocale === loc ? '#fdfaf5' : '#9c8b6a',
                  transition: 'background 120ms ease, color 120ms ease',
                }}
              >
                {loc === 'nl' ? t('languageNl') : t('languageEn')}
              </button>
            ))}
          </div>
        </div>

        {/* Contract display */}
        <div
          style={{
            maxHeight: 'min(60vh, 480px)',
            overflowY: 'auto',
            border: '0.5px solid rgba(30,21,8,0.14)',
            borderRadius: '12px',
            background: '#fff',
            padding: '24px 28px',
          }}
        >
          <MinimalMarkdown content={activeContract} />
        </div>

        {/* Signature section */}
        <div
          style={{
            border: '1.5px solid #d4820a',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
              fontSize: '18px',
              color: '#1e1508',
              margin: 0,
            }}
          >
            {t('sectionTitle')}
          </h2>

          {/* Full name */}
          <div>
            <label style={labelStyle} htmlFor="contract-name">
              {t('nameLabel')}
            </label>
            <input
              id="contract-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              placeholder={t('namePlaceholder')}
              style={inputStyle}
            />
          </div>

          {/* Signature canvas */}
          <div>
            <label style={labelStyle}>
              {t('signatureLabel')}
            </label>
            <SignatureCanvas
              ref={signatureCanvasRef}
              onSign={(dataUrl) => setSignatureDataUrl(dataUrl)}
              onClear={() => setSignatureDataUrl(null)}
              locked={false}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => signatureCanvasRef.current?.clear()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '12px',
                  color: '#9c8b6a',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                {t('signatureClear')}
              </button>
            </div>
          </div>

          {/* Combined T&Cs + DPA checkbox */}
          <Checkbox checked={termsAccepted} onChange={setTermsAccepted}>
            {activeLocale === 'nl' ? (
              <>
                Ik heb de{' '}
                <a href={termsHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  algemene voorwaarden
                </a>
                {' '}en de{' '}
                <a href={dpaHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  verwerkersovereenkomst
                </a>
                {' '}van The Tafel gelezen en aanvaard.
              </>
            ) : (
              <>
                I have read and accept the{' '}
                <a href={termsHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  general terms and conditions
                </a>
                {' '}and the{' '}
                <a href={dpaHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  data processing agreement
                </a>
                {' '}of The Tafel.
              </>
            )}
          </Checkbox>

          {/* Authority checkbox */}
          <Checkbox checked={authorityConfirmed} onChange={setAuthorityConfirmed}>
            {t('authorityLabel', { restaurantName: restaurantLegalName })}
          </Checkbox>
        </div>

        {/* Contract changed error */}
        {contractChanged && (
          <div
            style={{
              padding: '14px 16px',
              background: 'rgba(198,74,74,0.08)',
              borderRadius: '10px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#1e1508',
            }}
          >
            <p style={{ margin: '0 0 8px' }}>{t('errorContractChanged')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                border: '1px solid rgba(30,21,8,0.2)',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                color: '#1e1508',
                cursor: 'pointer',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
              }}
            >
              {t('refresh')}
            </button>
          </div>
        )}
      </div>
    </StepFrame>
  )
}
