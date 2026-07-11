// lib/orders/openOrJoinTab.ts
//
// Pay-at-table needs a single open tab per (restaurant, table). A naive
// INSERT would race two concurrent submits, so we serialise with a
// short-lived Redis lock keyed on the table id (reusing the booking slot
// lock's Redis instance, namespaced under 'tab:{tableId}' so it never
// collides with a real booking slot lock), then look up the open tab and
// either return it or create one.
//
// The caller (transactionalInsert.ts) does the tabs.total_cents bump itself,
// inside the same lock, so the two writes (INSERT orders + UPDATE tabs)
// can't interleave with another submit on the same table.

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock'

export type OpenOrJoinTabResult =
  | { ok: true; tabId: string; created: boolean; lockToken: string }
  | { ok: false; reason: 'busy' | 'redis_error' | 'db_error'; message?: string }

function tabLockLabel(tableId: string): string {
  return `tab:${tableId}`
}

/**
 * Acquire the tab lock and resolve to a tab id.
 *
 * IMPORTANT: the caller MUST call `releaseTabLock(lockToken, restaurantId, tableId)`
 * in a finally block after doing whatever tab-writing work needs the lock.
 */
export async function openOrJoinTab(
  restaurantId: string,
  tableId: string,
): Promise<OpenOrJoinTabResult> {
  const lockLabel = tabLockLabel(tableId)
  const lock = await acquireSlotLock(restaurantId, lockLabel)
  if (!lock.ok) {
    return { ok: false, reason: lock.reason }
  }

  const admin = await createSupabaseServerClientAdmin()

  // Look for an open tab on this table.
  const { data: existing, error: lookupErr } = await admin
    .from('tabs')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle()

  if (lookupErr) {
    console.error('[openOrJoinTab] tabs lookup failed', lookupErr.message)
    await releaseSlotLock(lock.token, restaurantId, lockLabel)
    return { ok: false, reason: 'db_error', message: lookupErr.message }
  }

  if (existing) {
    return { ok: true, tabId: existing.id, created: false, lockToken: lock.token }
  }

  // No open tab — create one.
  const { data: created, error: insertErr } = await admin
    .from('tabs')
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      status: 'open',
      total_cents: 0,
      currency: 'EUR',
    })
    .select('id')
    .single()

  if (insertErr || !created) {
    console.error('[openOrJoinTab] tabs insert failed', insertErr?.message)
    await releaseSlotLock(lock.token, restaurantId, lockLabel)
    return {
      ok: false,
      reason: 'db_error',
      message: insertErr?.message ?? 'insert returned no row',
    }
  }

  return { ok: true, tabId: created.id, created: true, lockToken: lock.token }
}

export async function releaseTabLock(
  lockToken: string,
  restaurantId: string,
  tableId: string,
): Promise<void> {
  await releaseSlotLock(lockToken, restaurantId, tabLockLabel(tableId))
}
