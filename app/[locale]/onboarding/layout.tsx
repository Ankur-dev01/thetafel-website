// app/[locale]/onboarding/layout.tsx
//
// Server component. Guards every page under /onboarding/*.
//
// Guard logic (per Phase 1 PRD §C.1 / §6.1):
//   1. No authenticated user                     → /login
//   2. User has no email_confirmed_at            → /verify-email
//   3. Restaurant exists and status = 'active'   → /dashboard
//      (EXCEPTION: /onboarding/set-password is exempt — password recovery
//      routes through this page even for active restaurants. See
//      app/[locale]/auth/confirm/route.ts type='recovery' branch.)
//   4. No restaurant row yet                     → render normally.
//      Step 1 in C.2 creates the row on first field blur via auto-save.
//
// The layout itself renders no chrome — each step page wraps its content
// in <StepLayout> (built in C.1 sub-step 3) which handles the visual frame.

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = rawLocale === 'en' ? 'en' : 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''

  const supabase = await createSupabaseServerClient()

  // Guard 1 — must be authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`${localePrefix}/login`)
  }

  // Guard 2 — email must be verified.
  // For magic-link signups Supabase sets email_confirmed_at when verifyOtp
  // succeeds in /auth/confirm. If somehow a session exists without it,
  // bounce back to verify-email so a fresh link can be sent.
  if (!user.email_confirmed_at) {
    const emailParam = user.email
      ? `?email=${encodeURIComponent(user.email)}`
      : ''
    redirect(`${localePrefix}/verify-email${emailParam}`)
  }

  // Determine the current path inside /onboarding so we can exempt
  // set-password from Guard 3 (active restaurants must still be able to
  // reset their password via /auth/confirm?type=recovery → set-password).
  const requestHeaders = await headers()
  const pathname =
    requestHeaders.get('x-invoke-path') ??
    requestHeaders.get('next-url') ??
    requestHeaders.get('x-pathname') ??
    ''
  const isSetPasswordPage = pathname.endsWith('/onboarding/set-password')

  // Guard 3 — restaurant already published → dashboard.
  // Skipped on set-password so password recovery remains usable.
  if (!isSetPasswordPage) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (restaurant?.status === 'active') {
      redirect(`${localePrefix}/dashboard`)
    }
  }

  return <>{children}</>
}
