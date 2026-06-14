import QRCode from 'qrcode'
import sharp from 'sharp'

interface RenderOptions {
  accentColor: string
  label?: string
  sizePx?: number
}

export async function renderQrPng(
  text: string,
  { accentColor, label, sizePx = 1024 }: RenderOptions
): Promise<Buffer> {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' })
  const N = qr.modules.size
  const quietModules = 4
  const totalModules = N + quietModules * 2
  const moduleSize = sizePx / totalModules
  const cornerRadius = moduleSize * 0.35

  const hasLabel = typeof label === 'string' && label.length > 0
  const labelStripHeight = hasLabel ? Math.round(sizePx * 0.08) : 0
  const totalHeight = sizePx + labelStripHeight

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${totalHeight}" viewBox="0 0 ${sizePx} ${totalHeight}">`,
    `<rect width="${sizePx}" height="${totalHeight}" fill="#ffffff"/>`
  )

  function isInEye(x: number, y: number): boolean {
    if (x < 7 && y < 7) return true
    if (x >= N - 7 && y < 7) return true
    if (x < 7 && y >= N - 7) return true
    return false
  }

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!qr.modules.get(x, y)) continue
      if (isInEye(x, y)) continue
      const px = (quietModules + x) * moduleSize
      const py = (quietModules + y) * moduleSize
      parts.push(
        `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${moduleSize.toFixed(2)}" height="${moduleSize.toFixed(2)}" rx="${cornerRadius.toFixed(2)}" fill="${accentColor}"/>`
      )
    }
  }

  const eyePositions: [number, number][] = [
    [0, 0],
    [N - 7, 0],
    [0, N - 7],
  ]
  for (const [ex, ey] of eyePositions) {
    const ox = (quietModules + ex) * moduleSize
    const oy = (quietModules + ey) * moduleSize
    const outerSize = 7 * moduleSize
    const innerSize = 5 * moduleSize
    const centreSize = 3 * moduleSize
    const innerOffset = moduleSize
    const centreOffset = 2 * moduleSize

    parts.push(
      `<rect x="${ox.toFixed(2)}" y="${oy.toFixed(2)}" width="${outerSize.toFixed(2)}" height="${outerSize.toFixed(2)}" rx="${(moduleSize * 1.4).toFixed(2)}" fill="${accentColor}"/>`,
      `<rect x="${(ox + innerOffset).toFixed(2)}" y="${(oy + innerOffset).toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" rx="${(moduleSize * 1.0).toFixed(2)}" fill="#ffffff"/>`,
      `<rect x="${(ox + centreOffset).toFixed(2)}" y="${(oy + centreOffset).toFixed(2)}" width="${centreSize.toFixed(2)}" height="${centreSize.toFixed(2)}" rx="${(moduleSize * 0.6).toFixed(2)}" fill="${accentColor}"/>`
    )
  }

  if (hasLabel) {
    const fontSize = Math.round(labelStripHeight * 0.55)
    const cx = sizePx / 2
    const cy = sizePx + labelStripHeight / 2
    parts.push(
      `<text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="#1e1508">${escapeXml(label!)}</text>`
    )
  }

  parts.push('</svg>')
  const svg = parts.join('')

  return await sharp(Buffer.from(svg)).png().toBuffer()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
