import 'server-only'

/**
 * Input sanitisation primitives for consumer-facing endpoints.
 *
 * Every function is pure, no I/O, no dependencies. They clean valid-but-messy
 * input into the canonical shape the DB and downstream code expect. They do
 * NOT reject — rejection is the validator's job (lib/consumer/schemas.ts).
 *
 * A typical pipeline:
 *   raw input → sanitise → validate → DB write
 *
 * If a sanitiser returns null, the input was so malformed (or empty after
 * trimming) that no sensible value can be derived. The downstream validator
 * catches that and returns a 400.
 */

// Unicode code-point boundaries used by the control-char regexes below.
// Written as hex literals to avoid any encoding issues in the source file.
const CTRL_EXCEPT_TAB_LF = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\r]/g
const CTRL_ALL            = /[\x00-\x1F\x7F]/g

// ── Whitespace + control-character hygiene ───────────────────────────────────

/**
 * Strip ASCII control characters (< 0x20) except tab and newline, plus the
 * DEL character (0x7f). Allows normal printable Unicode through unchanged.
 *
 * Keeps `\n` and `\t` because notes and longer text might legitimately have
 * line breaks. Strips `\r` (carriage return) to normalise CRLF to LF.
 */
export function stripControlChars(s: string): string {
  return s.replace(CTRL_EXCEPT_TAB_LF, '')
}

/**
 * Collapse runs of whitespace (spaces, tabs) into single spaces. Preserves
 * newlines so multi-line notes stay multi-line.
 */
export function collapseSpaces(s: string): string {
  return s.replace(/[ \t]+/g, ' ')
}

/**
 * Generic single-line text sanitiser. Strips control chars including
 * newlines, collapses spaces, trims. Returns null for empty result.
 */
export function sanitizeSingleLine(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null
  const cleaned = s
    .replace(CTRL_ALL, ' ')  // any control char → space
    .replace(/\s+/g, ' ')   // collapse all whitespace
    .trim()
  if (!cleaned) return null
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned
}

/**
 * Multi-line text sanitiser. Strips control chars except \n and \t,
 * collapses runs of spaces, normalises line endings, trims. Returns null
 * for empty result.
 */
export function sanitizeMultiLine(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null
  const cleaned = stripControlChars(s)
    .replace(/\n{3,}/g, '\n\n')  // cap blank-line runs
    .replace(/[ \t]+/g, ' ')     // collapse spaces/tabs
    .replace(/^\s+|\s+$/g, '')   // trim
  if (!cleaned) return null
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned
}

// ── Domain-specific sanitisers ──────────────────────────────────────────────

/** Person's full name: single-line, cap 100. */
export function sanitizeName(s: unknown): string | null {
  return sanitizeSingleLine(s, 100)
}

/** Free-text booking / order note: multi-line, cap 500. */
export function sanitizeNote(s: unknown): string | null {
  return sanitizeMultiLine(s, 500)
}

/** Per-item modifier note in an order line: single-line, cap 200. */
export function sanitizeItemNote(s: unknown): string | null {
  return sanitizeSingleLine(s, 200)
}

/** Company name for takeaway invoices: single-line, cap 100. */
export function sanitizeCompanyName(s: unknown): string | null {
  return sanitizeSingleLine(s, 100)
}

// ── Email ────────────────────────────────────────────────────────────────────

/**
 * Normalise an email address: trim, lowercase. Returns null if not a string
 * or empty-after-trim. Does NOT validate the format here — that's the
 * validator's job. A returned string still needs to pass the email regex.
 */
export function normalizeEmail(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const trimmed = s.trim().toLowerCase()
  return trimmed || null
}

/**
 * Email format check matching the DB CHECK constraint `guests_email_check`.
 * Permissive RFC-ish — accepts internationalised local parts, requires a dot
 * in the domain.
 */
export function isValidEmail(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(s)
}

// ── Phone ────────────────────────────────────────────────────────────────────

/**
 * Normalise a Dutch / international phone number to E.164.
 *
 * Accepts:
 *   - `+31612345678`   (already E.164) → passes through
 *   - `0612345678`     (Dutch national) → `+31612345678`
 *   - `31612345678`    (intl. without +) → `+31612345678`
 * After stripping spaces, dashes, parens and dots. Returns null if no rule
 * matches. The output (when non-null) always matches the DB CHECK
 * `phone ~ '^\+[1-9][0-9]{1,14}$'`.
 *
 * Why not libphonenumber: 200KB+ for a feature that ~99% of input handles
 * with three branches. The remaining edge cases get a clear UI error.
 */
export function normalizePhone(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const stripped = s.replace(/[\s\-().]/g, '')
  if (!stripped) return null

  // E.164 input
  if (stripped.startsWith('+')) {
    return /^\+[1-9][0-9]{1,14}$/.test(stripped) ? stripped : null
  }

  // Dutch national: 10 digits starting with 0
  if (/^0[0-9]{9}$/.test(stripped)) {
    return `+31${stripped.slice(1)}`
  }

  // International without +
  if (/^[1-9][0-9]{6,14}$/.test(stripped)) {
    return `+${stripped}`
  }

  return null
}

export function isValidPhone(s: string): boolean {
  return /^\+[1-9][0-9]{1,14}$/.test(s)
}

// ── Booleans / numbers ──────────────────────────────────────────────────────

/** Coerce truthy values (true, 'true', 'on', '1', 1) to true, else false. */
export function coerceBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const lower = v.trim().toLowerCase()
    return lower === 'true' || lower === 'on' || lower === '1' || lower === 'yes'
  }
  return false
}

/** Coerce to integer, or null if it can't be parsed cleanly. */
export function coerceInteger(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v)) {
    return v
  }
  if (typeof v === 'string') {
    const trimmed = v.trim()
    if (!/^-?[0-9]+$/.test(trimmed)) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}
