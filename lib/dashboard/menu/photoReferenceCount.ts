import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { deletePhotoObjects } from './photoStorage'

// lib/dashboard/menu/photoReferenceCount.ts
//
// Guard against deleting a storage object another item still points at.
//
// Nothing in the live data shares a photo_path today, and D4.4's UUID-suffixed
// keys make a natural collision impossible — so this is defensive, not a fix
// for an observed bug. It earns its place because the cost of being wrong is
// asymmetric: a skipped delete leaks one small object, while an over-eager
// delete silently breaks another item's photo with no way to tell from the
// row (photo_path would still look perfectly valid). Cheap insurance, and it
// also covers rows created outside this code path — the legacy seed script
// wrote shared `demo/` keys by hand.

/** How many OTHER items reference this path. The item being edited is excluded — its own reference is the one being replaced. */
export async function countOtherReferences(
  restaurantId: string,
  photoPath: string | null,
  excludeItemId: string,
): Promise<number> {
  if (!photoPath) return 0
  const admin = await createSupabaseServerClientAdmin()
  const { count, error } = await admin
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .neq('id', excludeItemId)
    .or(`photo_path.eq.${photoPath},photo_thumb_path.eq.${photoPath}`)

  if (error) {
    // Fail closed: if we can't prove the object is unreferenced, keep it.
    console.warn('[photoReferenceCount] lookup failed, keeping object', { photoPath, error: error.message })
    return 1
  }
  return count ?? 0
}

/** Delete the previous renditions, but only those no other item still uses. */
export async function safeCleanupPhoto(
  restaurantId: string,
  itemId: string,
  oldFullPath: string | null,
  oldThumbPath: string | null,
): Promise<{ deleted: string[]; kept: string[] }> {
  const deleted: string[] = []
  const kept: string[] = []

  for (const path of [oldFullPath, oldThumbPath]) {
    if (!path) continue
    const refs = await countOtherReferences(restaurantId, path, itemId)
    if (refs === 0) deleted.push(path)
    else kept.push(path)
  }

  await deletePhotoObjects(deleted)
  return { deleted, kept }
}
