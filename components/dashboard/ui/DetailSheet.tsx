'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * DetailSheet — phone full-screen sheet sliding in from the right.
 * Backdrop tap closes. Traps focus while open; restores focus on close.
 *
 * Callers render this unconditionally inside a `md:hidden` wrapper (the
 * desktop equivalent is a separate `DetailPanel` in a `hidden md:block`
 * sibling) — the CSS hides the sheet's markup on desktop, but React effects
 * don't know that. Without the `min-width: 768px` check below, `open`'s
 * scroll-lock and focus-trap effects still fire on desktop the moment an
 * item is selected, locking body scroll and stealing focus into an
 * invisible panel until the item selection is cleared.
 */

type DetailSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footerAction?: React.ReactNode;
};

export default function DetailSheet({
  open,
  onClose,
  title,
  children,
  footerAction,
}: DetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const effectiveOpen = open && !isDesktop;

  // Focus management: remember the opener, focus the panel, restore on close.
  useEffect(() => {
    if (effectiveOpen) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else {
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    }
  }, [effectiveOpen]);

  // Prevent body scroll while open; close on Escape; trap Tab inside.
  useEffect(() => {
    if (!effectiveOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [effectiveOpen, onClose]);

  return (
    <>
      <div
        className={
          'fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ' +
          (effectiveOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
        }
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!effectiveOpen}
        tabIndex={-1}
        className={
          'fixed inset-y-0 right-0 z-50 w-full max-w-[480px] bg-cream flex flex-col outline-none transition-transform duration-200 ' +
          (effectiveOpen ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/60">
          <h2
            className="text-[18px] text-[#1e1508] truncate"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            tabIndex={effectiveOpen ? 0 : -1}
            className="tafel-tap p-2 -m-1 rounded text-[#1e1508] hover:bg-[#f0e8d8] transition-colors"
            aria-label="Sluiten"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footerAction && (
          <div className="px-4 py-3 bg-white/60 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footerAction}
          </div>
        )}
      </div>
    </>
  );
}
