/**
 * Onboarding layout
 *
 * Wraps every onboarding step page in the two-pane shell (dark sidebar +
 * cream main pane). Skips the shell for /set-password, which is Phase B
 * auth and not part of the onboarding wizard.
 *
 * The shell handles auth redirects and status-based redirects. Step pages
 * themselves are children of this layout.
 */

import { headers } from 'next/headers'
import OnboardingShell from '@/components/onboarding/shell/OnboardingShell'
export const dynamic = 'force-dynamic'
type Params = { locale: string }

export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<Params>
}) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  // Read the current pathname to skip the shell for auth pages.
  const hdrs = await headers()
  const pathname =
    hdrs.get('x-invoke-path') ??
    hdrs.get('x-pathname') ??
    hdrs.get('next-url') ??
    hdrs.get('referer') ??
    ''

  // Phase B auth pages (set-password) live under /onboarding/ in the URL
  // tree but are not part of the onboarding wizard. They render without
  // the shell so the auth flow is untouched.
  if (pathname.includes('/set-password')) {
    return <>{children}</>
  }

  return <OnboardingShell locale={locale}>{children}</OnboardingShell>
}
