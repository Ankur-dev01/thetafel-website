// lib/dashboard/settings/floorPlanValidation.ts
//
// Shared floor-plan-payload validation, imported by BOTH the client editor
// and the mutating route. The client copy is UX only — the server always
// re-validates the parsed payload against the restaurant's actual current
// zone/table ids before writing, and is the authority.
//
// D5.2 scope only covers renaming/reordering EXISTING zones (no zone
// create/delete — that stays in onboarding), so every zone id in a payload
// must already belong to the restaurant. Same story for table zone_id
// assignment and for update/delete table ids — no phantom ids anywhere.
//
// Column names are the live schema, not generic placeholders: `label` (not
// `name`), `seats` (not `capacity`, CHECK 1..30, not the build-plan's
// guessed 200), and two independent booleans (`is_bookable`,
// `is_qr_enabled`) instead of one generic "active" flag.

export type FloorZonePatch = {
  id: string
  name: string
  display_order: number
}

export type FloorTablePatch = {
  id: string | null // null = new table, server assigns an id
  zone_id: string
  label: string
  seats: number
  is_bookable: boolean
  is_qr_enabled: boolean
}

export type FloorSavePayload = {
  zones: FloorZonePatch[]
  tables: FloorTablePatch[]
  deletedTableIds: string[]
}

export type ValidationError = { field: string; code: string }

export const MAX_ZONE_NAME_LENGTH = 60
export const MAX_TABLE_LABEL_LENGTH = 50
export const MIN_SEATS = 1
export const MAX_SEATS = 30 // matches restaurant_tables_seats_check
const MAX_ZONES = 20
const MAX_TABLES = 200

/**
 * Parse an untrusted request body into a FloorSavePayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Field-level/business rules are validateFloorSavePayload's job.
 */
export function parseFloorSavePayload(raw: unknown): FloorSavePayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const body = raw as Record<string, unknown>

  if (!Array.isArray(body.zones) || body.zones.length > MAX_ZONES) return null
  if (!Array.isArray(body.tables) || body.tables.length > MAX_TABLES) return null
  if (!Array.isArray(body.deletedTableIds) || body.deletedTableIds.length > MAX_TABLES) return null

  const zones: FloorZonePatch[] = []
  for (const raw of body.zones) {
    if (typeof raw !== 'object' || raw === null) return null
    const zone = raw as Record<string, unknown>
    if (typeof zone.id !== 'string' || zone.id.length === 0) return null
    if (typeof zone.name !== 'string') return null
    if (typeof zone.display_order !== 'number' || !Number.isInteger(zone.display_order)) return null
    zones.push({ id: zone.id, name: zone.name, display_order: zone.display_order })
  }

  const tables: FloorTablePatch[] = []
  for (const raw of body.tables) {
    if (typeof raw !== 'object' || raw === null) return null
    const table = raw as Record<string, unknown>
    if (table.id !== null && typeof table.id !== 'string') return null
    if (typeof table.zone_id !== 'string' || table.zone_id.length === 0) return null
    if (typeof table.label !== 'string') return null
    if (typeof table.seats !== 'number' || !Number.isInteger(table.seats)) return null
    if (typeof table.is_bookable !== 'boolean') return null
    if (typeof table.is_qr_enabled !== 'boolean') return null
    tables.push({
      id: table.id as string | null,
      zone_id: table.zone_id,
      label: table.label,
      seats: table.seats,
      is_bookable: table.is_bookable,
      is_qr_enabled: table.is_qr_enabled,
    })
  }

  const deletedTableIds: string[] = []
  for (const raw of body.deletedTableIds) {
    if (typeof raw !== 'string' || raw.length === 0) return null
    deletedTableIds.push(raw)
  }

  return { zones, tables, deletedTableIds }
}

export type FloorValidationContext = {
  /** Zone ids the restaurant actually has (non-deleted). No zone create in D5.2 — every payload zone id must be one of these. */
  knownZoneIds: Set<string>
  /** Table ids the restaurant actually has (non-deleted). Update/delete ids must be one of these. */
  knownTableIds: Set<string>
}

/**
 * Business rules for a floor-plan save payload. Run this on both the client
 * (before enabling Save, using the ids from the page's initial load) and the
 * server (before writing, using ids freshly reloaded from the DB — the
 * server copy is authoritative and also catches a stale/tampered client).
 */
export function validateFloorSavePayload(
  payload: FloorSavePayload,
  context: FloorValidationContext,
): ValidationError[] {
  const errors: ValidationError[] = []
  const { zones, tables, deletedTableIds } = payload
  const { knownZoneIds, knownTableIds } = context

  const seenZoneNames = new Set<string>()
  for (const zone of zones) {
    if (!knownZoneIds.has(zone.id)) {
      errors.push({ field: 'zones', code: 'zone_unknown_id' })
      continue
    }
    const trimmed = zone.name.trim()
    if (trimmed.length === 0) {
      errors.push({ field: 'zones', code: 'zone_name_required' })
    } else if (trimmed.length > MAX_ZONE_NAME_LENGTH) {
      errors.push({ field: 'zones', code: 'zone_name_too_long' })
    }
    const key = trimmed.toLowerCase()
    if (seenZoneNames.has(key)) {
      errors.push({ field: 'zones', code: 'zone_name_duplicate' })
    }
    seenZoneNames.add(key)
  }

  const seenTableLabels = new Set<string>()
  const seenTableIds = new Set<string>()
  for (const table of tables) {
    if (table.id !== null) {
      if (!knownTableIds.has(table.id)) {
        errors.push({ field: 'tables', code: 'table_unknown_id' })
      }
      if (seenTableIds.has(table.id)) {
        errors.push({ field: 'tables', code: 'table_unknown_id' })
      }
      seenTableIds.add(table.id)
    }

    if (!knownZoneIds.has(table.zone_id)) {
      errors.push({ field: 'tables', code: 'table_unknown_zone' })
    }

    const trimmedLabel = table.label.trim()
    if (trimmedLabel.length === 0) {
      errors.push({ field: 'tables', code: 'table_label_required' })
    } else if (trimmedLabel.length > MAX_TABLE_LABEL_LENGTH) {
      errors.push({ field: 'tables', code: 'table_label_too_long' })
    }
    const labelKey = trimmedLabel.toLowerCase()
    if (seenTableLabels.has(labelKey)) {
      errors.push({ field: 'tables', code: 'table_label_duplicate' })
    }
    seenTableLabels.add(labelKey)

    if (table.seats < MIN_SEATS || table.seats > MAX_SEATS) {
      errors.push({ field: 'tables', code: 'table_seats_invalid' })
    }
  }

  for (const id of deletedTableIds) {
    if (!knownTableIds.has(id)) {
      errors.push({ field: 'deletedTableIds', code: 'delete_unknown_id' })
    }
    if (seenTableIds.has(id)) {
      // Can't both update and delete the same table id in one payload.
      errors.push({ field: 'deletedTableIds', code: 'delete_unknown_id' })
    }
  }

  return errors
}
