// components/consumer/booking/StepR3.tsx
//
// Zone picker. Visible only when guestZoneChoiceEnabled is true AND the
// selected slot has more than one available zone (visibleSteps gate upstream).
// Renders one card per available-at-slot zone plus a "No preference" card
// that leaves zoneId=null (system picks at booking time).

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBookingFlow } from '@/lib/booking/state';
import type { ConsumerZone } from '@/lib/booking/zones';

interface Props {
  /** All bookable zones for the restaurant, ordered by displayOrder. */
  zones: ConsumerZone[];
}

export function StepR3({ zones }: Props) {
  const t = useTranslations('booking.r3');
  const { draft, updateDraft, setCanContinue } = useBookingFlow();

  // Filter to zones available at the selected slot.
  const availableZones = useMemo(
    () => zones.filter((z) => draft.selectedSlotZoneIds.includes(z.id)),
    [zones, draft.selectedSlotZoneIds],
  );

  // Tracks whether the user explicitly chose "No preference" (leaving zoneId=null).
  // This is separate from the uninitialized state where no choice has been made.
  const [explicitNoPref, setExplicitNoPref] = useState(false);

  useEffect(() => {
    setCanContinue(draft.zoneId != null || explicitNoPref);
  }, [draft.zoneId, explicitNoPref, setCanContinue]);

  function selectZone(zoneId: string) {
    updateDraft({ zoneId });
    setExplicitNoPref(false);
  }

  function selectNoPreference() {
    updateDraft({ zoneId: null });
    setExplicitNoPref(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(18px, 3vw, 22px)',
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {t('heading')}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {availableZones.map((zone) => (
          <ZoneCard
            key={zone.id}
            label={zone.name}
            selected={draft.zoneId === zone.id && !explicitNoPref}
            onClick={() => selectZone(zone.id)}
          />
        ))}
        <ZoneCard
          label={t('no_preference')}
          hint={t('no_preference_hint')}
          selected={explicitNoPref}
          onClick={selectNoPreference}
        />
      </div>
    </div>
  );
}

function ZoneCard({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  let bg: string;
  let color: string;
  let border: string;
  if (selected) {
    bg = 'var(--amber, #d4820a)';
    color = '#fff';
    border = '1px solid transparent';
  } else if (hovered) {
    bg = 'rgba(15, 13, 8, 0.08)';
    color = 'var(--night, #0f0d08)';
    border = '1px solid rgba(15, 13, 8, 0.12)';
  } else {
    bg = 'rgba(15, 13, 8, 0.04)';
    color = 'var(--night, #0f0d08)';
    border = '1px solid rgba(156, 139, 106, 0.2)';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={selected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: '16px 20px',
        borderRadius: 8,
        border,
        background: bg,
        color,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s ease, border-color 0.1s ease',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 16,
          lineHeight: 1.2,
          color: selected ? '#fff' : 'var(--night, #0f0d08)',
        }}
      >
        {label}
      </span>
      {hint ? (
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-jost), sans-serif',
            color: selected ? 'rgba(255,255,255,0.75)' : 'rgba(15, 13, 8, 0.5)',
          }}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}
