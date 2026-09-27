/**
 * Small helpers for interpreting raw Postgres errors surfaced through
 * Supabase clients (which don't re-throw as typed exceptions).
 */

type PostgresErrorLike = {
  code?: string
  details?: string | null
  message?: string | null
}

/**
 * True when `error` is a Postgres unique_violation (23505) that names
 * `column`. Checks both `.message` and `.details` — `.message` reliably
 * contains the violated constraint/index name (e.g. `duplicate key value
 * violates unique constraint "restaurants_btw_number_unique_idx"`), while
 * `.details` (the `Key (column)=(value) already exists.` form) is not
 * always populated by Supabase's PostgrestError for index-based (as
 * opposed to table-constraint-based) unique violations. Naming the
 * column/index consistently (e.g. `restaurants_<column>_unique_idx`) is
 * what makes this substring check reliable — verified in production
 * against the actual error shape, not just Postgres docs.
 */
export function isUniqueViolationOnColumn(
  error: PostgresErrorLike,
  column: string
): boolean {
  if (error.code !== '23505') return false
  return (error.message ?? '').includes(column) || (error.details ?? '').includes(column)
}
