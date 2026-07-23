/**
 * Thin client-side wrapper around the pause/resume routes. Callers handle
 * their own loading state; these just do the fetch + shape the result.
 */

export type PauseResumeResult = { ok: true } | { ok: false; error: string }

export async function pauseRestaurant(): Promise<PauseResumeResult> {
  try {
    const res = await fetch('/api/dashboard/restaurant/pause', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body?.error ?? 'unknown_error' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}

export async function resumeRestaurant(): Promise<PauseResumeResult> {
  try {
    const res = await fetch('/api/dashboard/restaurant/resume', { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body?.error ?? 'unknown_error' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
