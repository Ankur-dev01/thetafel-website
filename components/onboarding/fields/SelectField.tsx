'use client';

import { useId, useState } from 'react';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectOptionGroup = {
  label: string;
  options: SelectOption[];
};

export type SelectFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[] | SelectOptionGroup[];
  placeholder?: string;
  onBlur?: () => void;
};

function isOptionGroup(
  item: SelectOption | SelectOptionGroup
): item is SelectOptionGroup {
  return (item as SelectOptionGroup).options !== undefined;
}

export default function SelectField({
  label,
  hint,
  error,
  required,
  disabled,
  id,
  className,
  value,
  onChange,
  options,
  placeholder,
  onBlur,
}: SelectFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [focused, setFocused] = useState(false);

  const hasError = !!error;

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 44px 14px 18px',
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
    color: value ? '#1e1508' : '#9c8b6a',
    outline: 'none',
    transition: 'all 0.2s',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
    boxShadow: focused && !hasError ? '0 0 0 4px rgba(212,130,10,0.08)' : 'none',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
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
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? `${inputId}-help` : undefined}
          style={selectStyle}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((item, i) =>
            isOptionGroup(item) ? (
              <optgroup key={`group-${i}`} label={item.label}>
                {item.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            )
          )}
        </select>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9c8b6a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            right: '18px',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
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
