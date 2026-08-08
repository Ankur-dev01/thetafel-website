// lib/dashboard/settings/hoursValidation.ts
//
// Shared availability-payload validation, imported by BOTH the client editor
// and the mutating route. The client copy is UX only — the server always
// re-validates the parsed payload before writing, and is the authority.
//
// Mirrors lib/dashboard/menu/categoryValidation.ts's three-function shape:
// parse (shape-only) -> normalize (n/a here, payload is already normalized
// client-side) -> validate (business rules).

export type ServiceScope = 'all' | 'reservations' | 'takeaway' | 'qr'
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const PER_SERVICE_SCOPES: ServiceScope[] = ['reservations', 'takeaway', 'qr']

export type AvailabilityRow = {
  day_of_week: DayOfWeek
  service_scope: ServiceScope
  open_time: string // 'HH:MM'
  close_time: string // 'HH:MM'
  closes_next_day: boolean
  tag_brunch: boolean
  tag_lunch: boolean
  tag_dinner: boolean
}

export type HoursSavePayload = {
  hoursPerServiceOverride: boolean
  rows: AvailabilityRow[]
}

export type ValidationError = { field: string; code: string }

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_ROWS = 28 // 4 scopes x 7 days ceiling

/**
 * Parse an untrusted request body into a HoursSavePayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Field-level/business rules are validateHoursSavePayload's job.
 */
export function parseHoursSavePayload(raw: unknown): HoursSavePayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const body = raw as Record<string, unknown>

  if (typeof body.hoursPerServiceOverride !== 'boolean') return null
  if (!Array.isArray(body.rows) || body.rows.length > MAX_ROWS) return null

  const rows: AvailabilityRow[] = []
  for (const raw of body.rows) {
    if (typeof raw !== 'object' || raw === null) return null
    const row = raw as Record<string, unknown>

    if (
      typeof row.day_of_week !== 'number' ||
      !Number.isInteger(row.day_of_week) ||
      row.day_of_week < 1 ||
      row.day_of_week > 7
    ) {
      return null
    }
    if (
      row.service_scope !== 'all' &&
      row.service_scope !== 'reservations' &&
      row.service_scope !== 'takeaway' &&
      row.service_scope !== 'qr'
    ) {
      return null
    }
    if (typeof row.open_time !== 'string' || !HHMM_RE.test(row.open_time)) return null
    if (typeof row.close_time !== 'string' || !HHMM_RE.test(row.close_time)) return null
    if (typeof row.closes_next_day !== 'boolean') return null
    if (typeof row.tag_brunch !== 'boolean') return null
    if (typeof row.tag_lunch !== 'boolean') return null
    if (typeof row.tag_dinner !== 'boolean') return null

    rows.push({
      day_of_week: row.day_of_week as DayOfWeek,
      service_scope: row.service_scope,
      open_time: row.open_time,
      close_time: row.close_time,
      closes_next_day: row.closes_next_day,
      tag_brunch: row.tag_brunch,
      tag_lunch: row.tag_lunch,
      tag_dinner: row.tag_dinner,
    })
  }

  return { hoursPerServiceOverride: body.hoursPerServiceOverride, rows }
}

/**
 * Business rules for a hours save payload. Run this on both the client
 * (before enabling Save) and the server (before writing) — the server copy
 * is authoritative and also catches tampering (e.g. a forged closes_next_day).
 */
export function validateHoursSavePayload(payload: HoursSavePayload): ValidationError[] {
  const errors: ValidationError[] = []
  const { hoursPerServiceOverride, rows } = payload

  const seen = new Set<string>()
  const scopesWithRows = new Set<ServiceScope>()

  for (const row of rows) {
    const key = `${row.day_of_week}:${row.service_scope}`
    if (seen.has(key)) {
      errors.push({ field: 'rows', code: 'duplicate_row' })
    }
    seen.add(key)
    scopesWithRows.add(row.service_scope)

    if (!hoursPerServiceOverride && row.service_scope !== 'all') {
      errors.push({ field: 'rows', code: 'scope_mismatch' })
    }
    if (hoursPerServiceOverride && row.service_scope === 'all') {
      errors.push({ field: 'rows', code: 'scope_mismatch' })
    }

    if (row.open_time === row.close_time) {
      errors.push({ field: 'rows', code: 'close_equals_open' })
    }

    const expectedClosesNextDay = row.close_time < row.open_time
    if (row.closes_next_day !== expectedClosesNextDay) {
      errors.push({ field: 'rows', code: 'closes_next_day_mismatch' })
    }
  }

  if (hoursPerServiceOverride) {
    for (const scope of PER_SERVICE_SCOPES) {
      if (!scopesWithRows.has(scope)) {
        errors.push({ field: 'rows', code: 'scope_empty' })
      }
    }
  }

  return errors
}
