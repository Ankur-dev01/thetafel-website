'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Labels = {
  // Primary color section
  colorSectionTitle: string
  colorSectionDescription: string
  colorPresetLabel: string
  colorCustomLabel: string
  colorPreviewLabel: string
  colorContrastWarning: string
  // Logo section
  logoSectionTitle: string
  logoSectionDescription: string
  logoNoneSet: string
  logoUploadLabel: string
  logoUploading: string
  logoUploadError: string
  logoRemoveLabel: string
  logoRemoveConfirm: string
  // Hero section
  heroSectionTitle: string
  heroSectionDescription: string
  heroNoneSet: string
  heroUploadLabel: string
  heroUploading: string
  heroUploadError: string
  // Save
  save: string
  saving: string
  saved: string
  saveError: string
}

type Props = {
  initial: {
    primaryHex: string
    logoUrl: string | null
    heroUrl: string | null
  }
  labels: Labels
}

// Same preset set as W2's book-now button — restaurant-brand common starts
const PRESET_COLORS = [
  '#d4820a', // The Tafel amber (default)
  '#c2410c', // warm red-orange
  '#065f46', // deep green
  '#1e40af', // blue
  '#1e1508', // earth dark
] as const

function getLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Warn if the picked color has poor contrast against white text.
// Consumer surfaces (MenuItemCard's Toevoegen button) render white text on
// the primary color, so anything above ~0.6 luminance means white text is
// hard to read. Warn only — never blocks the save (restaurant autonomy).
const CONTRAST_WARN_THRESHOLD = 0.6

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

export default function BrandingForm({ initial, labels }: Props) {
  const router = useRouter()

  const [primaryHex, setPrimaryHex] = useState(initial.primaryHex)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [heroUrl, setHeroUrl] = useState<string | null>(initial.heroUrl)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [logoStatus, setLogoStatus] = useState<'idle' | 'uploading' | 'error'>('idle')
  const [heroStatus, setHeroStatus] = useState<'idle' | 'uploading' | 'error'>('idle')

  const logoInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)

  const colorDirty = primaryHex.toLowerCase() !== initial.primaryHex.toLowerCase()
  const contrastPoor = useMemo(() => getLuminance(primaryHex) > CONTRAST_WARN_THRESHOLD, [primaryHex])

  async function handleColorSave() {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/dashboard/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_hex: primaryHex }),
      })
      if (!res.ok) {
        setSaveStatus('error')
        return
      }
      setSaveStatus('saved')
      router.refresh()
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleLogoUpload(file: File) {
    setLogoStatus('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/branding/logo', { method: 'POST', body: fd })
      if (!res.ok) {
        setLogoStatus('error')
        return
      }
      const body = await res.json()
      setLogoUrl(body.logoUrl ?? null)
      setLogoStatus('idle')
      router.refresh()
    } catch {
      setLogoStatus('error')
    }
  }

  async function handleLogoRemove() {
    if (!confirm(labels.logoRemoveConfirm)) return
    setLogoStatus('uploading')
    try {
      const res = await fetch('/api/dashboard/branding/logo', { method: 'DELETE' })
      if (!res.ok) {
        setLogoStatus('error')
        return
      }
      setLogoUrl(null)
      setLogoStatus('idle')
      router.refresh()
    } catch {
      setLogoStatus('error')
    }
  }

  async function handleHeroUpload(file: File) {
    setHeroStatus('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/branding/hero', { method: 'POST', body: fd })
      if (!res.ok) {
        setHeroStatus('error')
        return
      }
      const body = await res.json()
      setHeroUrl(body.heroUrl ?? null)
      setHeroStatus('idle')
      router.refresh()
    } catch {
      setHeroStatus('error')
    }
  }

  return (
    <div className="mt-6 space-y-6 pb-24">
      {/* Section 1 — Primary color */}
      <section className="bg-white rounded-card p-5" data-testid="branding-color-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.colorSectionTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.colorSectionDescription}
        </p>

        <div className="mt-4">
          <label className="block text-[13px] text-[#1e1508] mb-2" style={labelStyle}>
            {labels.colorPresetLabel}
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((color) => {
              const isActive = color.toLowerCase() === primaryHex.toLowerCase()
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setPrimaryHex(color)}
                  aria-label={color}
                  aria-pressed={isActive}
                  data-testid={`branding-preset-${color.replace('#', '')}`}
                  className="w-8 h-8 rounded-full tafel-tap"
                  style={{
                    background: color,
                    outline: isActive ? '2px solid #1e1508' : 'none',
                    outlineOffset: isActive ? '2px' : '0',
                  }}
                />
              )
            })}
            <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-[#6f6353] cursor-pointer" style={{ ...labelStyle, fontWeight: 500 }}>
              <input
                type="color"
                value={primaryHex}
                onChange={(e) => setPrimaryHex(e.target.value)}
                className="w-6 h-6 rounded border border-[#e7ddc9] cursor-pointer"
                aria-label={labels.colorCustomLabel}
                data-testid="branding-color-custom"
              />
              {labels.colorCustomLabel}
            </label>
          </div>
        </div>

        {/* Mock preview — a "Toevoegen" button rendered with the pending color */}
        <div className="mt-4">
          <div className="text-[13px] text-[#1e1508] mb-2" style={labelStyle}>
            {labels.colorPreviewLabel}
          </div>
          <div className="rounded-lg border border-[#e7ddc9] bg-[#faf5ea] p-6 flex items-center justify-center">
            <button
              type="button"
              data-testid="branding-color-preview-button"
              className="rounded-full px-6 py-2.5"
              style={{
                background: primaryHex,
                color: '#ffffff',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              Toevoegen
            </button>
          </div>
          {contrastPoor && (
            <p className="mt-2 text-[12px] text-[#c2410c] leading-relaxed" data-testid="branding-contrast-warning" style={{ ...labelStyle, fontWeight: 500 }}>
              {labels.colorContrastWarning}
            </p>
          )}
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleColorSave}
            disabled={!colorDirty || saveStatus === 'saving'}
            data-testid="branding-color-save"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
            style={labelStyle}
          >
            {saveStatus === 'saving' ? labels.saving : saveStatus === 'saved' ? labels.saved : labels.save}
          </button>
          {saveStatus === 'error' && (
            <span className="ml-3 text-[12px] text-[#c2410c]" data-testid="branding-color-save-error" style={{ ...labelStyle, fontWeight: 500 }}>
              {labels.saveError}
            </span>
          )}
        </div>
      </section>

      {/* Section 2 — Logo */}
      <section className="bg-white rounded-card p-5" data-testid="branding-logo-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.logoSectionTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.logoSectionDescription}
        </p>

        <div className="mt-4 flex items-start gap-4 flex-wrap">
          <div className="w-24 h-24 rounded-lg border border-[#e7ddc9] bg-[#faf5ea] flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" data-testid="branding-logo-preview" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[11px] text-[#8c8577] uppercase tracking-[0.06em]" data-testid="branding-logo-none" style={labelStyle}>
                {labels.logoNoneSet}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              data-testid="branding-logo-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleLogoUpload(f)
                e.target.value = ''
              }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoStatus === 'uploading'}
                data-testid="branding-logo-upload"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={labelStyle}
              >
                {logoStatus === 'uploading' ? labels.logoUploading : labels.logoUploadLabel}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  disabled={logoStatus === 'uploading'}
                  data-testid="branding-logo-remove"
                  className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
                  style={labelStyle}
                >
                  {labels.logoRemoveLabel}
                </button>
              )}
            </div>
            {logoStatus === 'error' && (
              <span className="text-[12px] text-[#c2410c]" data-testid="branding-logo-error" style={{ ...labelStyle, fontWeight: 500 }}>
                {labels.logoUploadError}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Section 3 — Cover photo */}
      <section className="bg-white rounded-card p-5" data-testid="branding-hero-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.heroSectionTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.heroSectionDescription}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div className="w-full aspect-[3/1] rounded-lg border border-[#e7ddc9] bg-[#faf5ea] flex items-center justify-center overflow-hidden">
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroUrl} alt="Cover" data-testid="branding-hero-preview" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] text-[#8c8577] uppercase tracking-[0.06em]" data-testid="branding-hero-none" style={labelStyle}>
                {labels.heroNoneSet}
              </span>
            )}
          </div>
          <div>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              data-testid="branding-hero-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleHeroUpload(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => heroInputRef.current?.click()}
              disabled={heroStatus === 'uploading'}
              data-testid="branding-hero-upload"
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={labelStyle}
            >
              {heroStatus === 'uploading' ? labels.heroUploading : labels.heroUploadLabel}
            </button>
            {heroStatus === 'error' && (
              <span className="ml-3 text-[12px] text-[#c2410c]" data-testid="branding-hero-error" style={{ ...labelStyle, fontWeight: 500 }}>
                {labels.heroUploadError}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
