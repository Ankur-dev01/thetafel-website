import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Floor plan (zones + tables) query helpers (D5.2). Session client
 * throughout — `zones_owner_all` / `tables_owner_all` RLS policies grant the
 * owner full SELECT; the `restaurant_id` filter here is belt-and-braces on
 * top of that.
 *
 * Soft-delete convention: both tables use `deleted_at`, never a hard row
 * removal (matches onboarding's write path). Every read here filters
 * `deleted_at IS NULL` explicitly — never rely on RLS alone for that.
 *
 * Tables have no ordering column (schema gap accepted for D5.2 — see
 * FloorPlanEditor's sort comment), so within a zone they're presented in a
 * stable natural sort by `label` (T1, T2, T10 — not lexicographic T1, T10,
 * T2) rather than a persisted display_order.
 */

export type FloorZone = {
  id: string
  name: string
  displayOrder: number
}

export type FloorTable = {
  id: string
  zoneId: string
  label: string
  seats: number
  isBookable: boolean
  isQrEnabled: boolean
  qrImagePath: string | null
}

export type FloorPlanInitialData = {
  zones: FloorZone[]
  tablesByZone: Record<string, FloorTable[]>
  restaurantSlug: string
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export async function getFloorPlanInitialData(
  restaurantId: string,
  restaurantSlug: string,
): Promise<FloorPlanInitialData> {
  const supabase = await createSupabaseServerClient()

  const [{ data: zoneRows, error: zonesError }, { data: tableRows, error: tablesError }] = await Promise.all([
    supabase
      .from('zones')
      .select('id, name, display_order')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true }),
    supabase
      .from('restaurant_tables')
      .select('id, zone_id, label, seats, is_bookable, is_qr_enabled, qr_image_path')
      .eq('restaurant_id', restaurantId)
      .is('deleted_at', null),
  ])
  if (zonesError) throw zonesError
  if (tablesError) throw tablesError

  const zones: FloorZone[] = (zoneRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
  }))

  const tablesByZone: Record<string, FloorTable[]> = {}
  for (const zone of zones) {
    tablesByZone[zone.id] = []
  }
  for (const row of tableRows ?? []) {
    const table: FloorTable = {
      id: row.id,
      zoneId: row.zone_id,
      label: row.label,
      seats: row.seats,
      isBookable: row.is_bookable,
      isQrEnabled: row.is_qr_enabled,
      qrImagePath: row.qr_image_path,
    }
    if (!tablesByZone[table.zoneId]) tablesByZone[table.zoneId] = []
    tablesByZone[table.zoneId].push(table)
  }
  for (const zoneId of Object.keys(tablesByZone)) {
    tablesByZone[zoneId].sort((a, b) => naturalCollator.compare(a.label, b.label))
  }

  return { zones, tablesByZone, restaurantSlug }
}
