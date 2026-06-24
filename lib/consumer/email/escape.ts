import 'server-only'

/**
 * HTML-escape user-supplied strings for safe interpolation into email HTML.
 *
 * Covers the OWASP minimal set: & < > " '. Strict mode — no allowed tags.
 * Every guest-supplied field (name, note, etc.) passes through this before
 * embedding in an email body.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Extract a sensible first-name from a full name for greetings.
 * "Jan van der Berg" → "Jan", "Marie" → "Marie", "" → fallback.
 */
export function firstNameOf(fullName: string, fallback: string = ''): string {
  if (!fullName || typeof fullName !== 'string') return fallback
  const first = fullName.trim().split(/\s+/)[0]
  return first || fallback
}
