'use client';

/**
 * MobileShellWrapper
 *
 * Responsive two-pane layout for the onboarding shell.
 *
 *   Desktop (>= 768 px):
 *     - Sidebar fixed at 280px wide on the left.
 *     - Main pane fills the remaining width.
 *     - Mobile top bar hidden.
 *     - Slide-in mobile sidebar never visible.
 *
 *   Mobile (< 768 px):
 *     - Sidebar column hidden.
 *     - Mobile top bar visible with hamburger + small wordmark.
 *     - Tapping hamburger opens a slide-in mobile sidebar from the left.
 *
 * Uses CSS transform for the slide-in (always present in DOM, off-screen
 * by default, slides in when mobileOpen is true). This avoids conditional
 * rendering bugs where the slide-in panel leaks into the desktop layout.
 */

import { useEffect, useState } from 'react';

type MobileShellWrapperProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
};

export default function MobileShellWrapper({
  sidebar,
  children,
}: MobileShellWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on browser back/forward.
  useEffect(() => {
    function onPop() {
      setMobileOpen(false);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Prevent body scroll while the mobile sidebar is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#fdfaf5] text-[#1e1508]">
      {/* Mobile top bar (only visible < 768 px) */}
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
          className="leading-none text-right"
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
        {/* Desktop sidebar — fixed 280px column, visible >= 768 px */}
        <aside className="hidden md:flex md:w-[280px] md:flex-shrink-0 md:flex-col bg-[#1e1508] text-[#fdfaf5] sticky top-0 h-screen overflow-y-auto">
          {sidebar}
        </aside>

        {/* Mobile backdrop — always in DOM, opacity-controlled */}
        <div
          className={
            'md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ' +
            (mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
          }
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Mobile slide-in panel — always in DOM, translate-controlled */}
        <aside
          className={
            'md:hidden fixed inset-y-0 left-0 w-[280px] bg-[#1e1508] text-[#fdfaf5] z-50 overflow-y-auto transition-transform duration-200 ' +
            (mobileOpen ? 'translate-x-0' : '-translate-x-full')
          }
          role="dialog"
          aria-modal="true"
          aria-label="Onboarding navigation"
          aria-hidden={!mobileOpen}
        >
          <div className="flex justify-end p-2">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-2 text-[#fdfaf5] hover:bg-white/10 rounded transition-colors"
              aria-label="Close menu"
              tabIndex={mobileOpen ? 0 : -1}
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

        {/* Main content pane */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
