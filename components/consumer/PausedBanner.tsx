import { getTranslations } from 'next-intl/server'

/**
 * Polite "temporarily unavailable" card shown on consumer surfaces while a
 * restaurant is paused (manual or billing_suspended — both read identically
 * here; only the dashboard distinguishes them). No CTA, no illustration, no
 * dismissal — seen once, understood, done.
 */
export async function PausedBanner() {
  const t = await getTranslations('consumer.paused')

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '32px auto',
        padding: '32px 28px',
        backgroundColor: '#f7f2e9',
        borderRadius: 18,
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          color: '#3d2e18',
        }}
      >
        {t('message')}
      </p>
    </div>
  )
}
