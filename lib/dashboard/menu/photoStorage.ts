import 'server-only'

import { randomUUID } from 'node:crypto'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

// lib/dashboard/menu/photoStorage.ts
//
// All menu-photo storage writes go through here, always with the service-role
// client. `storage.objects` has RLS enabled and there is not a single policy
// covering the `menu-photos` bucket, so an authenticated browser upload would
// simply be denied — reads work only because the bucket is public. Writes are
// therefore gated behind our own authenticated routes, the same shape as
// app/api/v1/restaurants/photo/route.ts.

export const MENU_PHOTOS_BUCKET = 'menu-photos'

export type PhotoKeys = { fullKey: string; thumbKey: string }

/**
 * Restaurant-scoped folder, item-scoped filename, random suffix.
 *
 * The folder prefix is what makes per-restaurant cleanup possible (and keeps
 * one restaurant from ever overwriting another's photo, which the legacy
 * `demo/{slug}.jpg` seed keys could do). The random suffix means a replace
 * writes a brand-new object instead of mutating one that a CDN or an open
 * browser tab may still be caching.
 */
export function generatePhotoKeys(restaurantId: string, itemId: string): PhotoKeys {
  const uuid = randomUUID()
  return {
    fullKey: `${restaurantId}/${itemId}-${uuid}.webp`,
    thumbKey: `${restaurantId}/${itemId}-${uuid}-thumb.webp`,
  }
}

/**
 * Upload both renditions. If either fails, whichever succeeded is removed —
 * a half-written pair would leave an object nothing points at.
 */
export async function uploadPhotoPair(keys: PhotoKeys, full: Buffer, thumb: Buffer): Promise<void> {
  const admin = await createSupabaseServerClientAdmin()
  const bucket = admin.storage.from(MENU_PHOTOS_BUCKET)

  const [fullResult, thumbResult] = await Promise.all([
    bucket.upload(keys.fullKey, full, { contentType: 'image/webp', upsert: false }),
    bucket.upload(keys.thumbKey, thumb, { contentType: 'image/webp', upsert: false }),
  ])

  if (fullResult.error || thumbResult.error) {
    const rollback: string[] = []
    if (!fullResult.error) rollback.push(keys.fullKey)
    if (!thumbResult.error) rollback.push(keys.thumbKey)
    if (rollback.length > 0) {
      await bucket.remove(rollback).catch(() => undefined)
    }
    throw new Error(`upload_failed: ${fullResult.error?.message ?? thumbResult.error?.message}`)
  }
}

/**
 * Remove objects. A missing object is not an error — the desired end state is
 * "gone", and failing the caller over it would turn successful DB work into a
 * reported failure. Logged so leaks stay visible.
 */
export async function deletePhotoObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const admin = await createSupabaseServerClientAdmin()
  const { error } = await admin.storage.from(MENU_PHOTOS_BUCKET).remove(keys)
  if (error) {
    console.warn('[photoStorage] object delete failed', { keys, error: error.message })
  }
}
