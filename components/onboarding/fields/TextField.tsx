'use client';

import { useId, useState } from 'react';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

type InputType = 'text' | 'email' | 'tel' | 'url' | 'number' | 'password';

export type TextFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  type?: InputType;
  placeholder?: string;
  maxLength?: number;
  autoComplete?: string;
  onBlur?: () => void;
  onEnter?: () => void;
  /** Element rendered inside the input on the right (e.g. a unit suffix "min"). */
  trailingSlot?: React.ReactNode;
};

export default function TextField({
  label,
  hint,
  error,
  required,
  disabled,
  id,
  className,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  autoComplete,
  onBlur,
  onEnter,
  trailingSlot,
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [focused, setFocused] = useState(false);

  const hasError = !!error;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 18px',
    paddingRight: trailingSlot ? '52px' : '18px',
    backgroundColor: hasError ? '#fef2f2' : focused ? '#fdfaf5' : '#f8f2e6',
    border: '1.5px solid',
    borderColor: hasError
      ? '#ef4444'
      : focused
        ? 'rgba(212,130,10,0.5)'
        : 'transparent',
    borderRadius: '12px',
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    color: '#1e1508',
    outline: 'none',
    transition: 'all 0.2s',
    WebkitAppearance: 'none',
    boxShadow: focused && !hasError ? '0 0 0 4px rgba(212,130,10,0.08)' : 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    boxSizing: 'border-box',
  };

  return (
    <div className={className} style={{ width: '100%' }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'block',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#9c8b6a',
          marginBottom: '8px',
        }}
      >
        {label}
        {requiredMarker(required)}
      </label>

      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? `${inputId}-help` : undefined}
          style={inputStyle}
        />
        {trailingSlot && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '14px',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#9c8b6a',
              pointerEvents: 'none',
            }}
          >
            {trailingSlot}
          </div>
        )}
      </div>

      {(hint || error) && (
        <p
          id={`${inputId}-help`}
          style={{
            margin: '6px 2px 0',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            fontWeight: 400,
            color: hasError ? '#ef4444' : '#9c8b6a',
            lineHeight: 1.4,
          }}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
