import type { ReactNode } from 'react'
import { ConsumerShellTopBar } from '@/components/consumer/ConsumerShellTopBar'
import { ConsumerShellFooter } from '@/components/consumer/ConsumerShellFooter'

/**
 * Layout for every public consumer page under /r/[slug]/...
 *
 * Renders only the surrounding chrome:
 *   - a thin top bar with the Tafel wordmark and a language toggle
 *   - a thin footer with legal / privacy links
 *
 * The restaurant-specific header (photo, hours, address) is rendered inside
 * each page in C0.2 onwards, so that this layout can also be used for the
 * 404 page (which has no restaurant to render).
 *
 * ISR / cache headers are configured in C0.3 — for now this layout is
 * dynamic on every request.
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
