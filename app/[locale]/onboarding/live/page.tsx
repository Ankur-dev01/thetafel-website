import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: 'nl' | 'en' }>
}

/**
 * /onboarding/live is superseded by /dashboard (D0.4). Kept as a redirect
 * stub, not deleted — outbound links (old emails, bookmarks) still point
 * here.
 */
export default async function LivePage({ params }: PageProps) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
}
