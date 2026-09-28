import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

// lib/dashboard/branding/assetUpload.ts
//
// Shared upload/remove logic for the two D5.7 branding asset routes (logo,
// hero). Mirrors app/api/v1/restaurants/photo/route.ts's upload shape
// (direct passthrough, no re-encode) rather than the menu-photo sharp
// pipeline — branding assets are restaurant-supplied final artwork, not
// something we need to normalize into a fixed thumb/full pair.
//
// The object path includes the extension (`{restaurantId}/logo.{ext}`), so
// a re-upload that changes format (e.g. JPEG -> PNG) would otherwise leave
// the old file behind unreferenced — cleanupOtherExtensions handles that.

export const RESTAURANT_ASSETS_BUCKET = 'restaurant-assets'
export const MAX_ASSET_BYTES = 5 * 1024 * 1024 // 5MB — matches the bucket's limit

const ALLOWED_ASSET_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const ALL_EXTENSIONS = ['jpg', 'png', 'webp'] as const

export type BrandingAssetKind = 'logo' | 'hero'

export function extensionForMime(mime: string): string | null {
  return ALLOWED_ASSET_MIME[mime] ?? null
}

export type UploadAssetResult =
  | { ok: true; url: string }
  | { ok: false; error: 'invalid_type' | 'too_large' | 'upload_failed' }

export async function uploadBrandingAsset(
  restaurantId: string,
  kind: BrandingAssetKind,
  file: File
): Promise<UploadAssetResult> {
  const ext = extensionForMime(file.type)
  if (!ext) return { ok: false, error: 'invalid_type' }
  if (file.size > MAX_ASSET_BYTES) return { ok: false, error: 'too_large' }

  const admin = await createSupabaseServerClientAdmin()
  const bucket = admin.storage.from(RESTAURANT_ASSETS_BUCKET)
  const objectPath = `${restaurantId}/${kind}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await bucket.upload(objectPath, arrayBuffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) {
    console.error('[brandingAsset] upload failed', uploadError)
    return { ok: false, error: 'upload_failed' }
  }

  await cleanupOtherExtensions(restaurantId, kind, ext)

  const { data: publicUrlData } = bucket.getPublicUrl(objectPath)
  // Cache-bust so a re-upload visibly refreshes (same path, new content) —
  // same convention as the onboarding hero-photo route.
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`
  return { ok: true, url }
}

export async function removeBrandingAsset(restaurantId: string, kind: BrandingAssetKind): Promise<void> {
  const admin = await createSupabaseServerClientAdmin()
  const bucket = admin.storage.from(RESTAURANT_ASSETS_BUCKET)
  const keys = ALL_EXTENSIONS.map((ext) => `${restaurantId}/${kind}.${ext}`)
  // A missing object is not an error — the desired end state is "gone".
  const { error } = await bucket.remove(keys)
  if (error) {
    console.warn('[brandingAsset] remove failed', { restaurantId, kind, error: error.message })
  }
}

async function cleanupOtherExtensions(
  restaurantId: string,
  kind: BrandingAssetKind,
  keepExt: string
): Promise<void> {
  const staleKeys = ALL_EXTENSIONS.filter((ext) => ext !== keepExt).map(
    (ext) => `${restaurantId}/${kind}.${ext}`
  )
  const admin = await createSupabaseServerClientAdmin()
  const { error } = await admin.storage.from(RESTAURANT_ASSETS_BUCKET).remove(staleKeys)
  if (error) {
    console.warn('[brandingAsset] stale-extension cleanup failed', { restaurantId, kind, error: error.message })
  }
}
