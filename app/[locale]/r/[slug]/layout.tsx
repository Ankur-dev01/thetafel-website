import type { ReactNode } from 'react'
import { ConsumerShellTopBar } from '@/components/consumer/ConsumerShellTopBar'
import { ConsumerShellFooter } from '@/components/consumer/ConsumerShellFooter'

/**
 * ISR baseline for all consumer pages under /r/[slug]/...
 *
 * Pages re-render at most every 60 seconds on a fresh visit. On-demand
 * invalidation via `invalidateConsumerPage(slug)` purges the cache earlier
 * when the restaurant updates data in the dashboard.
 */
export const revalidate = 60

/**
 * Layout for every public consumer page under /r/[slug]/...
 *
 * Renders only the surrounding chrome:
 *   - a thin top bar with the Tafel wordmark and a language toggle
 *   - a thin footer with legal / privacy links
 *
 * The restaurant-specific header (photo, hours, address) is rendered inside
 * each page, so this layout can also wrap the 404.
 */
export default function ConsumerSlugLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--cream, #fdfaf5)',
        color: 'var(--night, #0f0d08)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ConsumerShellTopBar />
      <main style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <ConsumerShellFooter />
    </div>
  )
}
