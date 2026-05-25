'use client'

/**
 * MobileShellWrapper
 *
 * Client component that handles the responsive two-pane behaviour:
 *   - Desktop (>= 768 px): sidebar fixed left at 280 px, main pane fills rest.
 *   - Mobile (< 768 px): sidebar hidden behind hamburger; tap to slide in.
 *
 * Receives the sidebar contents and the main-pane children as props.
 * Holds the open/closed state for the mobile slide-in panel.
 */

import { useEffect, useState } from 'react'

type MobileShellWrapperProps = {
  sidebar: React.ReactNode
  children: React.ReactNode
}

export default function MobileShellWrapper({
  sidebar,
  children,
}: MobileShellWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close the slide-in on route changes (popstate).
  useEffect(() => {
    function onPop() {
      setMobileOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Prevent body scroll while the mobile sidebar is open.
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-[#fdfaf5] text-[#1e1508]">
      {/* Mobile top bar — visible < 768 px only */}
      <div className="md:hidden flex items-center justify-between border-b border-[#f0e8d8] bg-[#fdfaf5] px-4 py-3 sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded text-[#1e1508] hover:bg-[#f0e8d8] transition-colors"
          aria-label="Open menu"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div
          className="font-black leading-none text-right"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif' }}
        >
          <div
            className="text-[10px] tracking-[0.18em] text-[#d4820a]"
            style={{ fontWeight: 900 }}
          >
            THE
          </div>
          <div
            className="text-[18px] text-[#1e1508]"
            style={{ fontWeight: 900 }}
          >
            Tafel
          </div>
        </div>
      </div>

      <div className="flex min-h-screen">
        {/* Desktop sidebar — fixed at 280 px */}
        <aside className="hidden md:flex md:w-[280px] md:flex-shrink-0 md:flex-col bg-[#1e1508] text-[#fdfaf5] sticky top-0 h-screen overflow-y-auto">
          {sidebar}
        </aside>

        {/* Mobile slide-in sidebar */}
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            {/* Slide-in panel */}
            <aside
              className="md:hidden fixed inset-y-0 left-0 w-[280px] bg-[#1e1508] text-[#fdfaf5] z-50 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Onboarding navigation"
            >
              <div className="flex justify-end p-2">
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 text-[#fdfaf5] hover:bg-white/10 rounded transition-colors"
                  aria-label="Close menu"
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {sidebar}
            </aside>
          </>
        )}

        {/* Main content pane */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
