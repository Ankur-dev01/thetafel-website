import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import ReturnClient from '@/components/onboarding/subscription/ReturnClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'onboarding.subscription.return' })
  return { title: t('confirming.title') }
}

export default async function SubscriptionReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ id?: string }>
}) {
  const { locale } = await params
  const { id } = await searchParams

  return (
    <Suspense>
      <ReturnClient locale={locale} paymentId={id ?? null} />
    </Suspense>
  )
}
