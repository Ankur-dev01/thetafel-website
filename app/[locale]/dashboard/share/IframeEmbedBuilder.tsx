'use client'

import { useMemo, useState } from 'react'

type Labels = {
  heightLabel: string
  previewLabel: string
  snippetLabel: string
  copy: string
  copied: string
}

type Props = {
  embedUrl: string
  labels: Labels
}

const MIN_HEIGHT = 400
const MAX_HEIGHT = 1200
const DEFAULT_HEIGHT = 720

export default function IframeEmbedBuilder({ embedUrl, labels }: Props) {
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT)
  const [copied, setCopied] = useState(false)

  const clampedHeight = useMemo(() => {
    if (Number.isNaN(height)) return DEFAULT_HEIGHT
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(height)))
  }, [height])

  const snippet = useMemo(
    () =>
      `<iframe src="${embedUrl}" width="100%" height="${clampedHeight}" frameborder="0" style="border:0;max-width:100%;" title="Book a table"></iframe>`,
    [embedUrl, clampedHeight],
  )

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.getElementById('iframe-snippet-display') as HTMLTextAreaElement | null
      if (el) {
        el.select()
        try {
          document.execCommand('copy')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Silent
        }
      }
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Height dial */}
      <div>
        <label
          htmlFor="iframe-height-input"
          className="block text-[13px] text-[#1e1508] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.heightLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="iframe-height-input"
            type="number"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            step={20}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            onBlur={() => setHeight(clampedHeight)}
            className="w-28 rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[14px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          />
          <span
            className="text-[12px] text-[#6f6353]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            px
          </span>
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
        <div className="rounded-lg border border-[#e7ddc9] bg-white overflow-hidden">
          <iframe
            src={embedUrl}
            width="100%"
            height={clampedHeight}
            frameBorder={0}
            style={{ border: 0, maxWidth: '100%', display: 'block' }}
            title="Book a table preview"
          />
        </div>
      </div>

      {/* Snippet + copy */}
      <div>
        <label
          htmlFor="iframe-snippet-display"
          className="block text-[13px] text-[#1e1508] mb-1"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {labels.snippetLabel}
        </label>
        <textarea
          id="iframe-snippet-display"
          readOnly
          value={snippet}
          onFocus={(e) => e.currentTarget.select()}
          rows={3}
          className="w-full rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[12px] text-[#1e1508] resize-none"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 400 }}
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={handleCopy}
            data-testid="share-iframe-copy"
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
