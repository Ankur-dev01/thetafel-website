import type { DashboardAlertId } from './types'

/**
 * Client-only, per-device alert dismissal. Never touches the server —
 * dismissing an alert on one device has no effect on another. Scoped by
 * Amsterdam civil date so a new day resets everything automatically.
 */

const STORAGE_KEY = 'tafel.dashboard.alerts.dismissed'
const KEEP_DAYS = 3

type DismissalStore = Record<string, DashboardAlertId[]>

function readStore(): DismissalStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as DismissalStore
    return {}
  } catch {
    return {}
  }
}

function writeStore(store: DismissalStore): void {
  if (typeof window === 'undefined') return
  try {
    // Prune to the most recent KEEP_DAYS civil dates — lexicographic sort
    // works because the keys are YYYY-MM-DD, which sorts chronologically.
    const prunedKeys = Object.keys(store).sort().slice(-KEEP_DAYS)
    const pruned: DismissalStore = {}
    for (const key of prunedKeys) pruned[key] = store[key]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned))
  } catch {
    // Quota errors etc. — dismissal is a nicety, never worth surfacing.
  }
}

export function getDismissedIds(day: string): Set<DashboardAlertId> {
  const store = readStore()
  return new Set(store[day] ?? [])
}

export function dismissAlert(day: string, id: DashboardAlertId): void {
  if (typeof window === 'undefined') return
  const store = readStore()
  const existing = new Set(store[day] ?? [])
  existing.add(id)
  store[day] = Array.from(existing)
  writeStore(store)
}

/** Reserved for D9 debug tooling — not wired into any UI in D1.2. */
export function undoDismissAll(day: string): void {
  if (typeof window === 'undefined') return
  const store = readStore()
  delete store[day]
  writeStore(store)
}
