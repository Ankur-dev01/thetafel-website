// app/[locale]/r/[slug]/qr/order/[orderToken]/page.tsx
//
// C5.5 PLACEHOLDER. C5.6 will replace this file with the real polling status
// page. For now: minimal confirmation card so the guest doesn't hit a 404
// after submitting an order. Same URL as the eventual polling page — C5.6
// swaps the content, not the redirect target.
//
// Reads the order using the SECURITY DEFINER RPC `lookup_order_by_magic_link`,
// which hashes the plaintext token internally and returns the order row if
// still valid.

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

interface PageProps {
  params: Promise<{ locale: string; slug: string; orderToken: string }>
}

export default async function QrOrderPlaceholderPage({ params }: PageProps) {
  const { locale: rawLocale, orderToken } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  if (!TOKEN_RE.test(orderToken)) notFound()

  const admin = await createSupabaseServerClientAdmin()
  const { data: rows, error } = await admin.rpc('lookup_order_by_magic_link', {
    p_token: orderToken,
  })

  if (error || !rows || rows.length === 0) {
    notFound()
  }

  const order = rows[0]
  const t = await getTranslations({ locale, namespace: 'consumer.qr.orderConfirmation' })

  return (
    <section
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '48px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '32px 24px',
          boxShadow: '0 4px 24px rgba(30, 21, 8, 0.08)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(24px, 6vw, 28px)',
            lineHeight: 1.1,
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {t('received')}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#a86205',
            margin: '20px 0 0 0',
          }}
        >
          {t('codeLabel')}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 700,
            fontSize: '20px',
            color: 'var(--night, #0f0d08)',
            margin: '4px 0 0 0',
          }}
        >
          {order.order_ref}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.55,
            color: 'var(--stone, #7a7264)',
            margin: '20px 0 0 0',
          }}
        >
          {t('soon')}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: 'var(--stone, #7a7264)',
            margin: '12px 0 0 0',
            opacity: 0.8,
          }}
        >
          {t('help')}
        </p>
      </div>
    </section>
  )
}
