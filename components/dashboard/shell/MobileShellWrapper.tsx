'use client';

/**
 * MobileShellWrapper (dashboard)
 *
 * Structural passthrough for the dashboard's responsive chrome. Unlike the
 * onboarding wrapper there is no hamburger drawer — phone navigation is the
 * bottom tab bar — so this component only lays out:
 *
 *   Desktop (≥ 768px): dark sidebar fixed left (64px icon rail up to 1100px,
 *   240px full sidebar from 1100px), main pane padded to clear it.
 *
 *   Phone (< 768px): sidebar hidden; main pane gets bottom padding so content
 *   clears the fixed tab bar.
 */

type MobileShellWrapperProps = {
  sidebar: React.ReactNode;
  tabBar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
};

export default function MobileShellWrapper({
  sidebar,
  tabBar,
  header,
  children,
}: MobileShellWrapperProps) {
  return (
    <div className="min-h-screen bg-cream text-[#1e1508]">
      {/* Desktop sidebar — fixed to viewport; icon rail 768–1100px, full ≥ 1100px */}
      <aside className="hidden md:flex md:flex-col fixed top-0 left-0 h-screen w-16 min-[1100px]:w-60 bg-[#1e1508] text-[#fdfaf5] overflow-y-auto z-20">
        {sidebar}
      </aside>

      {/* Main pane */}
      <div className="md:pl-16 min-[1100px]:pl-60 min-h-screen flex flex-col">
        {header}
        <main className="flex-1 px-4 md:px-8 pb-24 md:pb-10">{children}</main>
      </div>

      {/* Phone bottom tab bar */}
      {tabBar}
    </div>
  );
}
