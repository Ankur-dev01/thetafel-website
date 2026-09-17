'use client'

import { useMemo, useState } from 'react'

type Labels = {
  textLabel: string
  textPlaceholder: string
  colorLabel: string
  colorCustomLabel: string
  previewLabel: string
  snippetLabel: string
  copy: string
  copied: string
}

type Props = {
  shareUrl: string
  defaultButtonText: string
  labels: Labels
}

// 5 preset swatches — amber default, then four common restaurant-brand
// starting points. Restaurants can go beyond via the native color input.
const PRESET_COLORS = [
  '#d4820a', // The Tafel amber (default)
  '#c2410c', // warm red-orange
  '#065f46', // deep green
  '#1e40af', // blue
  '#1e1508', // earth dark
] as const

/**
 * Rough perceptual luminance — good enough for picking readable text on
 * a solid-color button. Threshold picked empirically: 0.55 flips the
 * text from white to dark at roughly the point where solid-color CTAs
 * start reading as "light".
 */
function getLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return 0
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function pickTextColor(bg: string): string {
  return getLuminance(bg) > 0.55 ? '#1e1508' : '#ffffff'
}

/**
 * HTML-escape user-typed text before embedding it in the snippet string.
 * The restaurant is pasting the output into their own site, so this is
 * hygiene rather than a real XSS boundary — but a restaurant who types
 * `Reserveer >>` should get `Reserveer &gt;&gt;` in the snippet, not
 * broken markup.
 */
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function ButtonBuilder({
  shareUrl,
  defaultButtonText,
  labels,
}: Props) {
  const [text, setText] = useState(defaultButtonText)
  const [bgColor, setBgColor] = useState<string>(PRESET_COLORS[0])
  const [copied, setCopied] = useState(false)

  const textColor = useMemo(() => pickTextColor(bgColor), [bgColor])

  const snippet = useMemo(() => {
    const safeText = htmlEscape(text.trim() || defaultButtonText)
    return `<a href="${shareUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 24px;background:${bgColor};color:${textColor};text-decoration:none;font-family:sans-serif;font-weight:600;border-radius:9999px;">${safeText}</a>`
  }, [shareUrl, text, bgColor, textColor, defaultButtonText])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.getElementById('button-snippet-display') as HTMLTextAreaElement | null
      if (el) {
        el.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Silent — nothing more we can do
        }
      }
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Text input */}
      <div>
        <label
          htmlFor="button-text-input"
          className="block text-[13px] text-[#1e1508] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.textLabel}
        </label>
        <input
          id="button-text-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          placeholder={labels.textPlaceholder}
          className="w-full rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[14px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        />
      </div>

      {/* Color picker */}
      <div>
        <label
          className="block text-[13px] text-[#1e1508] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.colorLabel}
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => {
            const isActive = color.toLowerCase() === bgColor.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => setBgColor(color)}
                aria-label={color}
                aria-pressed={isActive}
                className="w-8 h-8 rounded-full tafel-tap"
                style={{
                  background: color,
                  outline: isActive ? '2px solid #1e1508' : 'none',
                  outlineOffset: isActive ? '2px' : '0',
                }}
              />
            )
          })}
          <label
            className="ml-2 inline-flex items-center gap-2 text-[12px] text-[#6f6353] cursor-pointer"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-6 h-6 rounded border border-[#e7ddc9] cursor-pointer"
              aria-label={labels.colorCustomLabel}
            />
            {labels.colorCustomLabel}
          </label>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <div
          className="block text-[13px] text-[#1e1508] mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.previewLabel}
        </div>
        <div className="rounded-lg border border-[#e7ddc9] bg-[#f7f2e9] p-6 flex items-center justify-center">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: bgColor,
              color: textColor,
              textDecoration: 'none',
              fontFamily: 'sans-serif',
              fontWeight: 600,
              borderRadius: '9999px',
            }}
          >
            {text.trim() || defaultButtonText}
          </a>
        </div>
      </div>

      {/* Snippet + copy */}
      <div>
        <label
          htmlFor="button-snippet-display"
          className="block text-[13px] text-[#1e1508] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.snippetLabel}
        </label>
        <textarea
          id="button-snippet-display"
          readOnly
          value={snippet}
          onFocus={(e) => e.currentTarget.select()}
          rows={4}
          className="w-full rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[12px] text-[#1e1508] resize-none"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 400 }}
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={handleCopy}
            data-testid="share-button-copy"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      </div>
    </div>
  )
}
