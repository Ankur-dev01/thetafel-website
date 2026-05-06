import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/set-password
 *
 * Sets the password for the currently authenticated user (first-time setup
 * after magic-link verification, or password reset after recovery flow).
 *
 * Auth: required. Reads the session cookie set by /auth/confirm.
 * Body:  { password: string }
 * Rules: password must be at least 8 characters.
 * Returns: 200 on success, 400 if too short, 401 if no session, 500 otherwise.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Auth check — must have a logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    // 2. Body validation
    let body: { password?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      )
    }

    const password = typeof body.password === 'string' ? body.password : ''

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: 'Password is too long.' },
        { status: 400 }
      )
    }

    // 3. Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      console.error('updateUser error:', updateError)
      return NextResponse.json(
        { error: 'Could not update password.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('set-password route error:', error)
    return NextResponse.json(
      { error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}