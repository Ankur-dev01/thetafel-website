import 'server-only'

/**
 * Server-side Cloudflare Turnstile verification.
 *
 * The widget renders client-side (added in C4 onwards) and produces a token.
 * The token gets POSTed to our API alongside the form data. The API calls
 * `verifyTurnstileToken(token, ip)` before processing. Failure returns false;
 * the API responds with 403.
 *
 * Dev bypass: if NODE_ENV === 'development' AND TURNSTILE_SECRET_KEY is
 * unset, verification is skipped (returns true). This lets local dev work
 * without Cloudflare account setup. Preview and production refuse to bypass.
 *
 * Cloudflare test keys (always-pass / always-fail) work normally — the secret
 * is set and we call siteverify; siteverify just returns the answer
 * Cloudflare promises for those keys.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult = {
  ok: boolean
  /** Reason for rejection if !ok. 'dev_bypass' | 'no_token' | 'siteverify_failed' | 'network_error' | 'misconfigured'. */
  reason?: string
  /** Cloudflare error codes from the response, if any. */
  errorCodes?: string[]
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * Always returns within ~3 seconds; we use AbortController to cap the call.
 * Never throws — callers can treat a `false` result as a hard reject.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  callerIp: string | undefined | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  const isDev = process.env.NODE_ENV === 'development'

  // Dev-only bypass: no secret configured + local dev = treat as ok.
  // This lets the consumer flows run end-to-end before Cloudflare is wired.
  if (isDev && !secret) {
    return { ok: true, reason: 'dev_bypass' }
  }

  if (!secret) {
    console.error('[turnstile] TURNSTILE_SECRET_KEY missing in non-dev env')
    return { ok: false, reason: 'misconfigured' }
  }

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { ok: false, reason: 'no_token' }
  }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (callerIp) form.set('remoteip', callerIp)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3500)

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('[turnstile] siteverify HTTP error', {
        status: response.status,
        tokenPrefix: token.slice(0, 8),
      })
      return { ok: false, reason: 'siteverify_failed' }
    }

    const data = (await response.json()) as {
      success?: boolean
      'error-codes'?: string[]
    }

    if (data.success === true) {
      return { ok: true }
    }

    const errorCodes = data['error-codes'] ?? []
    console.warn('[turnstile] siteverify rejected token', {
      tokenPrefix: token.slice(0, 8),
      errorCodes,
    })
    return { ok: false, reason: 'siteverify_failed', errorCodes }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[turnstile] siteverify timed out')
      return { ok: false, reason: 'network_error' }
    }
    console.error('[turnstile] siteverify network error', err)
    return { ok: false, reason: 'network_error' }
  } finally {
    clearTimeout(timeoutId)
  }
}
