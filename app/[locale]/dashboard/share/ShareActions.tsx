'use client'

import { useState } from 'react'

type Props = {
  shareUrl: string
  qrSvg: string
  restaurantSlug: string
  labels: {
    copy: string
    copied: string
    downloadQr: string
    downloading: string
  }
}

export default function ShareActions({
  shareUrl,
  qrSvg,
  restaurantSlug,
  labels,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input and let the user Cmd/Ctrl+C
      const el = document.getElementById('share-url-display') as HTMLInputElement | null
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

  async function handleDownload() {
    setDownloading(true)
    try {
      // Rasterise the server-rendered SVG to a 1024x1024 PNG on the client.
      // 1024 is large enough to print on a table tent without pixelation.
      const svgBlob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('QR image load failed'))
        img.src = svgUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 1024
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 2d context unavailable')
      // White background so printed QR has a solid quiet zone
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1024, 1024)
      ctx.drawImage(img, 0, 0, 1024, 1024)

      URL.revokeObjectURL(svgUrl)

      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl
      a.download = `thetafel-qr-${restaurantSlug}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[share] QR download failed', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-stretch gap-2">
        <input
          id="share-url-display"
          type="text"
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[14px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        />
        <button
          type="button"
          onClick={handleCopy}
          data-testid="share-copy"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] whitespace-nowrap"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {copied ? labels.copied : labels.copy}
        </button>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          data-testid="share-download-qr"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {downloading ? labels.downloading : labels.downloadQr}
        </button>
      </div>
    </div>
  )
}
