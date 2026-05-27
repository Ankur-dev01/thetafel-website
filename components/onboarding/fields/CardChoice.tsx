'use client';

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
  const isClickable = !disabled;

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    padding: '20px 22px',
    backgroundColor: selected ? '#fdfaf5' : '#f8f2e6',
    border: '2px solid',
    borderColor: selected ? accentColor : 'transparent',
    borderRadius: '16px',
    cursor: isClickable ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s',
    textAlign: 'left',
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    opacity: disabled ? 0.55 : 1,
    boxShadow: selected ? `0 0 0 4px ${accentColor}1a` : 'none',
  };

  return (
    <button
      type="button"
      className={className}
      onClick={isClickable ? onClick : undefined}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      style={cardStyle}
    >
      {icon && (
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: `${accentColor}1a`,
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
          }}
        >
          {icon}
        </div>
      )}

      <div
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: '#1e1508',
          lineHeight: 1.3,
          marginBottom: description ? '6px' : 0,
        }}
      >
        {title}
      </div>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 400,
            color: '#9c8b6a',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {(badge || (disabled && disabledReason)) && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(156, 139, 106, 0.18)',
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: disabled ? '#9c8b6a' : accentColor,
          }}
        >
          {disabled ? disabledReason : badge}
        </div>
      )}

      {selected && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
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
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fdfaf5"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  );
}
