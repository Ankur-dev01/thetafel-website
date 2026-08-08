import 'server-only'

import sharp from 'sharp'

// lib/dashboard/menu/photoProcessing.ts
//
// Turns an accepted upload into the two WebP renditions we store. Doing this
// server-side rather than with a browser Canvas keeps quality consistent and
// avoids the mobile-Safari memory limits that make client resizing flaky on
// exactly the devices owners photograph food with.

/** Longest edge of the full-size rendition. */
export const FULL_MAX_PX = 1200
/** The card thumbnail is a fixed square. */
export const THUMB_PX = 400

export type ProcessedPhoto = { full: Buffer; thumb: Buffer }

export async function processPhoto(buffer: Buffer): Promise<ProcessedPhoto> {
  // `.rotate()` with no argument applies the EXIF orientation to the pixels;
  // the subsequent WebP encode then drops the metadata entirely, so a photo
  // taken on a phone lands upright and without its GPS coordinates.
  const base = sharp(buffer).rotate()

  const [full, thumb] = await Promise.all([
    base
      .clone()
      // `inside` never crops and `withoutEnlargement` never upscales a small
      // original into a blurry larger one.
      .resize({ width: FULL_MAX_PX, height: FULL_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer(),
    base
      .clone()
      // `attention` picks the most salient region rather than the geometric
      // centre — on a plated dish that is usually the food, not the tablecloth.
      .resize({ width: THUMB_PX, height: THUMB_PX, fit: 'cover', position: 'attention' })
      .webp({ quality: 80, effort: 4 })
      .toBuffer(),
  ])

  return { full, thumb }
}
