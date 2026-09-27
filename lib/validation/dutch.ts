/**
 * Shared Dutch-format validators.
 *
 * These are pure format checks — they do NOT hit any external register
 * (KVK, VIES, etc.). The regexes are copied verbatim from the inline
 * versions previously living in the onboarding business step. Do not
 * "improve" or tighten them here without a separate discussion — a
 * regex change silently rejects previously-valid inputs.
 */

/** Dutch VAT (BTW) — NL[9 digits]B[2 digits], e.g. NL123456789B01. */
export function isValidDutchBtw(value: string): boolean {
  return /^NL[0-9]{9}B[0-9]{2}$/i.test(value.trim())
}

/** Dutch phone. Empty is valid — the field is optional. */
export function isValidDutchPhone(p: string): boolean {
  if (!p.trim()) return true
  return /^(\+31|0)[0-9\s\-.()]{7,14}$/.test(p.trim())
}

/** Email. Empty is valid — the field is optional. */
export function isValidEmail(e: string): boolean {
  if (!e.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}

/** Website URL. Empty is valid — the field is optional. */
export function isValidWebsite(url: string): boolean {
  if (!url.trim()) return true
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
