// components/consumer/booking/SlotGrid.tsx
//
// Pure presentational slot grid. Groups slots into Morning / Lunch / Dinner
// by HH:MM threshold (no per-slot shift tag in the API response). Hides any
// empty section. Each slot button reserves space for the capacity hint line
// so the grid doesn't jump between rows with and without hints.

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AvailabilitySlot } from '@/lib/booking/types';

interface Props {
  slots: AvailabilitySlot[];
  /** UTC ISO instant currently selected, or null. */
  selectedInstant: string | null;
  /** Called when the user picks a slot. */
  onSelect: (slot: AvailabilitySlot) => void;
}

const MORNING_END = '11:30';
const LUNCH_END = '15:00';
const LOW_CAPACITY_THRESHOLD = 4;

export function SlotGrid({ slots, selectedInstant, onSelect }: Props) {
  const t = useTranslations('booking.r2');

  const morning: AvailabilitySlot[] = [];
  const lunch: AvailabilitySlot[] = [];
  const dinner: AvailabilitySlot[] = [];
  for (const s of slots) {
    if (s.time < MORNING_END) morning.push(s);
    else if (s.time < LUNCH_END) lunch.push(s);
    else dinner.push(s);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <Section title={t('section_morning')} slots={morning} selectedInstant={selectedInstant} onSelect={onSelect} />
      <Section title={t('section_lunch')} slots={lunch} selectedInstant={selectedInstant} onSelect={onSelect} />
      <Section title={t('section_dinner')} slots={dinner} selectedInstant={selectedInstant} onSelect={onSelect} />
    </div>
  );
}

interface SectionProps {
  title: string;
  slots: AvailabilitySlot[];
  selectedInstant: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
}

function Section({ title, slots, selectedInstant, onSelect }: SectionProps) {
  if (slots.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(15, 13, 8, 0.45)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {slots.map((slot) => (
          <SlotButton
            key={slot.instant}
            slot={slot}
            isSelected={slot.instant === selectedInstant}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SlotButton({
  slot,
  isSelected,
  onSelect,
}: {
  slot: AvailabilitySlot;
  isSelected: boolean;
  onSelect: (slot: AvailabilitySlot) => void;
}) {
  const t = useTranslations('booking.r2');
  const [hovered, setHovered] = useState(false);
  const showHint = slot.remainingTables < LOW_CAPACITY_THRESHOLD;

  let bg: string;
  let color: string;
  let border: string;
  if (isSelected) {
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
    border = '1px solid rgba(156, 139, 106, 0.18)';
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={isSelected}
      style={{
        minHeight: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: 8,
        border,
        background: bg,
        color,
        cursor: 'pointer',
        padding: '8px 4px',
        transition: 'background 0.1s ease, border-color 0.1s ease',
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: isSelected ? 600 : 400,
          lineHeight: 1,
        }}
      >
        {slot.time}
      </span>
      {/* Reserved space for hint — always rendered to prevent grid jump */}
      <span
        aria-hidden={!showHint}
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--amber, #d4820a)',
          lineHeight: 1,
          minHeight: 11,
          opacity: showHint ? 1 : 0,
        }}
      >
        {showHint ? t('tables_left', { count: slot.remainingTables }) : ' '}
      </span>
    </button>
  );
}
