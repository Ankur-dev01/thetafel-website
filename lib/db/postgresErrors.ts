/**
 * Small helpers for interpreting raw Postgres errors surfaced through
 * Supabase clients (which don't re-throw as typed exceptions).
 */

type PostgresErrorLike = { code?: string; details?: string | null }

/**
 * True when `error` is a Postgres unique_violation (23505) whose detail
 * names `column`. Postgres' unique_violation detail is always
 * `Key (column)=(value) already exists.`, so this lets callers with more
 * than one unique constraint on a table disambiguate which one fired
 * instead of reporting every collision under one generic code.
 */
export function isUniqueViolationOnColumn(
  error: PostgresErrorLike,
  column: string
): boolean {
  if (error.code !== '23505') return false
  return (error.details ?? '').includes(column)
}
