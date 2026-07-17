const STORAGE_KEY = 'tafel-consent-v1'
const CONSENT_VERSION = 1
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

export const CONSENT_CHANGED_EVENT = 'tafel:consent-changed'
export const OPEN_COOKIE_SETTINGS_EVENT = 'tafel:open-cookie-settings'

export type ConsentCategories = {
  essential: true
  analytics: boolean
  marketing: false
}

export type StoredConsent = {
  version: number
  timestamp: number
  categories: ConsentCategories
}

export function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    if (parsed.version !== CONSENT_VERSION) return null
    if (Date.now() - parsed.timestamp > MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeConsent(categories: { analytics: boolean }): StoredConsent {
  const consent: StoredConsent = {
    version: CONSENT_VERSION,
    timestamp: Date.now(),
    categories: { essential: true, analytics: categories.analytics, marketing: false },
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }))
  return consent
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}

export function subscribeConsent(callback: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function getConsentSnapshot(): boolean {
  return readConsent()?.categories.analytics ?? false
}

export function getServerConsentSnapshot(): boolean {
  return false
}

export function getHasConsentSnapshot(): boolean {
  return readConsent() !== null
}

export function getServerHasConsentSnapshot(): boolean {
  return false
}
