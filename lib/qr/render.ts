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

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">`,
    `<rect width="${sizePx}" height="${sizePx}" fill="#ffffff"/>`
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

  if (label && label.length > 0 && label.length <= 4) {
    const cx = sizePx / 2
    const cy = sizePx / 2
    const labelRadius = sizePx * 0.085
    const fontSize = labelRadius * 1.1
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${labelRadius.toFixed(2)}" fill="#ffffff"/>`,
      `<text x="${cx}" y="${cy}" font-family="Jost, Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="${accentColor}">${escapeXml(label)}</text>`
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
