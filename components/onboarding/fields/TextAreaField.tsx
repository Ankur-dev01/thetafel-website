'use client';

import { useId, useState } from 'react';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

export type TextAreaFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  onBlur?: () => void;
  showCounter?: boolean;
};

export default function TextAreaField({
  label,
  hint,
  error,
  required,
  disabled,
  id,
  className,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
  onBlur,
  showCounter = false,
}: TextAreaFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [focused, setFocused] = useState(false);

  const hasError = !!error;

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 18px',
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
    resize: 'vertical',
    minHeight: `${rows * 24 + 32}px`,
    boxShadow: focused && !hasError ? '0 0 0 4px rgba(212,130,10,0.08)' : 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    lineHeight: 1.5,
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

      <textarea
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        aria-describedby={hint || error ? `${inputId}-help` : undefined}
        style={textareaStyle}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          marginTop: '6px',
          padding: '0 2px',
        }}
      >
        <p
          id={`${inputId}-help`}
          style={{
            margin: 0,
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            fontWeight: 400,
            color: hasError ? '#ef4444' : '#9c8b6a',
            lineHeight: 1.4,
            flex: 1,
          }}
        >
          {error || hint || ''}
        </p>
        {showCounter && maxLength && (
          <span
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '12px',
              color: value.length >= maxLength ? '#ef4444' : '#9c8b6a',
              flexShrink: 0,
            }}
            aria-live="polite"
          >
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
