import 'server-only'

import sharp from 'sharp'

// lib/dashboard/menu/photoValidation.ts
//
// Server-side validation for uploaded menu photos. The client does a matching
// pre-check for fast feedback, but nothing here trusts it — in particular the
// browser-supplied MIME string is advisory only. The existing onboarding
// upload (app/api/v1/restaurants/photo/route.ts:71-77) validates on
// `file.type` alone, which is trivially spoofable; this reads the actual
// bytes instead.

export const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB — matches the bucket's own file_size_limit
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MIN_DIMENSION_PX = 400 // shortest side; the thumbnail is 400x400
export const MAX_ASPECT_RATIO = 5 // a 5000x100 sliver is a mistake, not a dish photo

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number]

export type PhotoValidationError =
  | 'too_large'
  | 'bad_mime'
  | 'mime_mismatch'
  | 'too_small'
  | 'bad_aspect_ratio'
  | 'corrupt'

export type PhotoValidationResult =
  | { ok: true; actualMime: AllowedMime; width: number; height: number }
  | { ok: false; code: PhotoValidationError }

/**
 * Identify an image purely from its leading bytes. Returns null for anything
 * that isn't one of the three formats we accept.
 */
export function sniffMime(buffer: Buffer): AllowedMime | null {
  if (buffer.length < 12) return null

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  // WebP: 'RIFF' ....  'WEBP'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }

  return null
}

/**
 * Validate an uploaded photo. `declaredMime` is what the browser claimed; it
 * is checked against the sniffed value but never used on its own.
 */
export async function validatePhoto(buffer: Buffer, declaredMime: string): Promise<PhotoValidationResult> {
  if (buffer.length > MAX_SIZE_BYTES) return { ok: false, code: 'too_large' }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    return { ok: false, code: 'bad_mime' }
  }

  const actualMime = sniffMime(buffer)
  if (!actualMime) return { ok: false, code: 'mime_mismatch' }
  if (actualMime !== declaredMime) return { ok: false, code: 'mime_mismatch' }

  let width: number | undefined
  let height: number | undefined
  try {
    const meta = await sharp(buffer).metadata()
    width = meta.width
    height = meta.height
  } catch {
    // Passed the magic-byte check but sharp can't decode it — truncated or
    // deliberately malformed past the header.
    return { ok: false, code: 'corrupt' }
  }
  if (!width || !height) return { ok: false, code: 'corrupt' }

  if (Math.min(width, height) < MIN_DIMENSION_PX) return { ok: false, code: 'too_small' }

  const ratio = Math.max(width / height, height / width)
  if (ratio > MAX_ASPECT_RATIO) return { ok: false, code: 'bad_aspect_ratio' }

  return { ok: true, actualMime, width, height }
}
