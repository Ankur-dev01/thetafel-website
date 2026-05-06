import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/login
 *
 * Standard email/password login for restaurant owners.
 *
 * Rate limit: 5 attempts per IP per 15 minutes (sliding window).
 * Body: { email: string, password: string }
 * On success: Supabase SSR helper sets the auth cookies. Returns 200.
 * On failure: 401 with generic message (no email enumeration).
 * On rate limit: 429 with Retry-After header.
 */
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: false,
  prefix: 'login',
})

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '127.0.0.1'

    const isDev = process.env.NODE_ENV === 'development'
    const { success, reset } = await ratelimit.limit(ip)

    if (!success && !isDev) {
      const retryAfter = Math.max(
        1,
        Math.ceil((reset - Date.now()) / 1000)
      )
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': retryAfter.toString() } }
      )
    }

    // Parse + validate body
    let body: { email?: unknown; password?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      )
    }

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''
    const password =
      typeof body.password === 'string' ? body.password : ''

    if (!email || !password || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 }
      )
    }

    // Sign in via Supabase. The SSR helper writes session cookies on success.
    const supabase = await createSupabaseServerClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      return NextResponse.json(
        { error: 'Invalid credentials.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('login route error:', error)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
