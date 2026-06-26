// app/[locale]/r/[slug]/book/layout.tsx
//
// Booking-specific wrapper. Width constraint + vertical breathing room.
// The parent layout already provides the consumer top bar and footer.

import type { ReactNode } from 'react';

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 20px 80px',
      }}
    >
      {children}
    </div>
  );
}
