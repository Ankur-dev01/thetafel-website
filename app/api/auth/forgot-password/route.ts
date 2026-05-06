import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * POST /api/auth/forgot-password
 *
 * Sends a password-reset email via Supabase Auth.
 *
 * Rate limit: 3 requests per email per hour (sliding window).
 * Body: { email: string }
 * Returns: 200 ALWAYS (whether the email exists or not) — prevents email
 *          enumeration. The only non-200 response is 429 (rate limited).
 *
 * The reset email link redirects to /auth/confirm?type=recovery — the same
 * confirm route used for magic-link signup, but with the recovery flag so the
 * routing logic sends them to /onboarding/set-password instead of dashboard.
 */
const supabaseProd = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
  process.env.SUPABASE_PROD_SERVICE_ROLE_KEY!
)

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: false,
  prefix: 'forgot-password',
})

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    let body: { email?: unknown }
    try {
      body = await request.json()
    } catch {
      // Even on bad body, return 200 to prevent probing.
      return NextResponse.json({ success: true }, { status: 200 })
    }

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    // Bad email format → still pretend success (no enumeration via format check)
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ success: true }, { status: 200 })
    }

    // Rate limit per email
    const isDev = process.env.NODE_ENV === 'development'
    const { success, reset } = await ratelimit.limit(email)

    if (!success && !isDev) {
      const retryAfter = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000)
      )
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      )
    }

    // Fire the reset email. Errors are swallowed — we always tell the client
    // we sent the email, regardless of whether it actually exists.
    const { error: resetError } = await supabaseProd.auth.resetPasswordForEmail(
      email,
      { redirectTo: 'https://thetafel.nl/auth/confirm?type=recovery' }
    )

    if (resetError) {
      // Log only — never surface to the client.
      console.error('resetPasswordForEmail error:', resetError)
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('forgot-password route error:', error)
    // Even on unexpected error, return 200 — no enumeration signal.
    return NextResponse.json({ success: true }, { status: 200 })
  }
}
