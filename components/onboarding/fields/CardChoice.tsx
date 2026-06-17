'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

export type CardChoiceProps = {
  title: string;
  description?: string;
  accentColor?: string;
  icon?: ReactNode;
  badge?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
};

export default function CardChoice({
  title,
  description,
  accentColor = '#d4820a',
  icon,
  badge,
  selected,
  onClick,
  disabled,
  disabledReason,
  className,
}: CardChoiceProps) {
  const [hovered, setHovered] = useState(false);
  const isClickable = !disabled;

  const cardShadow = disabled
    ? 'none'
    : hovered
      ? '0 2px 4px rgba(30, 21, 8, 0.04), 0 22px 48px rgba(212, 130, 10, 0.16)'
      : '0 1px 2px rgba(30, 21, 8, 0.04), 0 16px 38px rgba(212, 130, 10, 0.12)';

  return (
    <button
      type="button"
      className={className}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={() => { if (isClickable) setHovered(true); }}
      onMouseLeave={() => { if (isClickable) setHovered(false); }}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      style={{
        position: 'relative',
        width: '100%',
        padding: '28px 26px',
        backgroundColor: disabled ? '#f5f0e3' : '#fbf6ec',
        border: 'none',
        outline: 'none',
        borderRadius: '18px',
        cursor: isClickable ? 'pointer' : 'not-allowed',
        transition: 'box-shadow 280ms ease, transform 220ms ease',
        textAlign: 'left',
        opacity: disabled ? 0.74 : 1,
        boxShadow: cardShadow,
        transform: hovered && isClickable ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      {/* Check chip — selected only */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '22px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5l2.5 2.5 4.5-5" stroke="#fdfaf5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Coming-soon / disabled pill */}
      {disabled && disabledReason && (
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '22px',
            backgroundColor: accentColor,
            color: '#fdfaf5',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: '10px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            padding: '5px 10px',
            borderRadius: '9999px',
          }}
        >
          {disabledReason}
        </div>
      )}

      {/* Badge (non-disabled) */}
      {badge && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '22px',
            backgroundColor: accentColor,
            color: '#fdfaf5',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: '10px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.1em',
            padding: '5px 10px',
            borderRadius: '9999px',
          }}
        >
          {badge}
        </div>
      )}

      {/* Identity icon — bare, no container */}
      {icon && (
        <div style={{ color: disabled ? '#b8a585' : accentColor, lineHeight: 0 }}>
          {icon}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontFamily: 'var(--font-raleway), sans-serif',
          fontWeight: 900,
          fontSize: '28px',
          color: disabled ? '#6f6353' : '#1e1508',
          lineHeight: 1.02,
          letterSpacing: '-0.025em',
          marginTop: icon ? '32px' : 0,
        }}
      >
        {title}
      </div>

      {/* Description */}
      {description && (
        <p
          style={{
            margin: '14px 0 0 0',
            fontSize: '13.5px',
            fontWeight: 400,
            color: '#9c8b6a',
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}
    </button>
  );
}
