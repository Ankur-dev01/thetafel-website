'use client';

import { useId } from 'react';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

export type ToggleFieldProps = Omit<BaseFieldProps, 'label'> & {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export default function ToggleField({
  label,
  description,
  hint,
  error,
  required,
  disabled,
  id,
  className,
  value,
  onChange,
}: ToggleFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const hasError = !!error;

  const handleToggle = () => {
    if (disabled) return;
    onChange(!value);
  };

  return (
    <div
      className={className}
      style={{
        width: '100%',
        padding: '16px 18px',
        backgroundColor: '#f8f2e6',
        borderRadius: '12px',
        border: hasError ? '1.5px solid #ef4444' : '1.5px solid transparent',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={handleToggle}
      role="presentation"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <label
            htmlFor={inputId}
            style={{
              display: 'block',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              color: '#1e1508',
              lineHeight: 1.3,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {label}
            {requiredMarker(required)}
          </label>
          {description && (
            <p
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: '#9c8b6a',
                lineHeight: 1.4,
              }}
            >
              {description}
            </p>
          )}
        </div>

        <button
          id={inputId}
          type="button"
          role="switch"
          aria-checked={value}
          aria-describedby={hint || error ? `${inputId}-help` : undefined}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          style={{
            position: 'relative',
            width: '44px',
            height: '24px',
            borderRadius: '999px',
            background: value ? '#d4820a' : '#c8b89a',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '2px',
              left: value ? '22px' : '2px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: '#fdfaf5',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}
          />
        </button>
      </div>

      {(hint || error) && (
        <p
          id={`${inputId}-help`}
          style={{
            margin: '10px 0 0',
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
