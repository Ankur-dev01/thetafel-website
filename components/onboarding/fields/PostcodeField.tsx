'use client';

/**
 * PostcodeField
 *
 * Dutch address-entry block:
 *   Row 1: Postcode | House number | House number addition (optional)
 *   Row 2: Street (autofilled via PDOK, editable)
 *   Row 3: City   (autofilled via PDOK, editable)
 *
 * Debounce-calls /api/pdok/lookup when postcode is valid (4 digits + 2
 * letters) and house number has at least one digit. Cancels in-flight
 * requests via AbortController to prevent race conditions.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

export type PostcodeFieldProps = Omit<BaseFieldProps, 'label'> & {
  postcode: string;
  houseNumber: string;
  houseNumberAddition: string;
  street: string;
  city: string;
  onPostcodeChange: (v: string) => void;
  onHouseNumberChange: (v: string) => void;
  onHouseNumberAdditionChange: (v: string) => void;
  onStreetChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onBlur?: () => void;
  heading?: string;
};

// ---- Helpers -------------------------------------------------------------

const POSTCODE_REGEX = /^\d{4}[A-Z]{2}$/;

function normalisePostcode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, '').slice(0, 6);
}

function leadingDigits(input: string): string {
  const m = input.match(/^\d+/);
  return m ? m[0] : '';
}

type LookupState =
  | { status: 'idle' }
  | { status: 'looking-up' }
  | { status: 'found' }
  | { status: 'not-found' }
  | { status: 'error' };

// ---- Component -----------------------------------------------------------

export default function PostcodeField({
  hint,
  error,
  required,
  disabled,
  id,
  className,
  heading,
  postcode,
  houseNumber,
  houseNumberAddition,
  street,
  city,
  onPostcodeChange,
  onHouseNumberChange,
  onHouseNumberAdditionChange,
  onStreetChange,
  onCityChange,
  onBlur,
}: PostcodeFieldProps) {
  const generatedId = useId();
  const postcodeId = id ?? `${generatedId}-postcode`;
  const houseNumberId = `${generatedId}-house`;
  const additionId = `${generatedId}-addition`;
  const streetId = `${generatedId}-street`;
  const cityId = `${generatedId}-city`;

  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for callbacks so the effect dep array stays clean
  const onStreetChangeRef = useRef(onStreetChange);
  const onCityChangeRef = useRef(onCityChange);
  useEffect(() => { onStreetChangeRef.current = onStreetChange; }, [onStreetChange]);
  useEffect(() => { onCityChangeRef.current = onCityChange; }, [onCityChange]);

  // ---- Debounced PDOK lookup ---------------------------------------------

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const cleanPostcode = normalisePostcode(postcode);
    const cleanNumber = leadingDigits(houseNumber);

    if (!POSTCODE_REGEX.test(cleanPostcode) || cleanNumber.length === 0) {
      setLookup({ status: 'idle' });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLookup({ status: 'looking-up' });

      try {
        const res = await fetch(
          `/api/pdok/lookup?postcode=${cleanPostcode}&huisnummer=${cleanNumber}`,
          { signal: controller.signal, cache: 'no-store' }
        );

        if (controller.signal.aborted) return;

        if (!res.ok) {
          setLookup({ status: 'error' });
          return;
        }

        const payload = await res.json() as { ok: boolean; address?: { street: string; city: string } };
        if (payload?.ok && payload.address?.street && payload.address?.city) {
          onStreetChangeRef.current(payload.address.street);
          onCityChangeRef.current(payload.address.city);
          setLookup({ status: 'found' });
        } else {
          setLookup({ status: 'not-found' });
        }
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return;
        setLookup({ status: 'error' });
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [postcode, houseNumber]);

  // ---- Change handlers ---------------------------------------------------

  const handlePostcodeChange = useCallback(
    (raw: string) => {
      onPostcodeChange(normalisePostcode(raw));
    },
    [onPostcodeChange]
  );

  // ---- Render ------------------------------------------------------------

  const hasError = !!error;
  const sectionHeading = heading ?? 'Address';

  return (
    <div className={className} style={{ width: '100%' }}>
      <div
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#9c8b6a',
          marginBottom: '12px',
        }}
      >
        {sectionHeading}
        {requiredMarker(required)}
      </div>

      {/* Row 1: postcode | house number | addition */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <SubField
          id={postcodeId}
          label="Postcode"
          value={postcode}
          onChange={handlePostcodeChange}
          onBlur={onBlur}
          placeholder="1011AC"
          maxLength={6}
          disabled={disabled}
          hasError={hasError}
          trailingSlot={<LookupIndicator state={lookup} />}
          autoComplete="postal-code"
        />
        <SubField
          id={houseNumberId}
          label="Number"
          value={houseNumber}
          onChange={onHouseNumberChange}
          onBlur={onBlur}
          placeholder="123"
          inputMode="numeric"
          disabled={disabled}
          hasError={hasError}
          autoComplete="address-line1"
        />
        <SubField
          id={additionId}
          label="Addition"
          value={houseNumberAddition}
          onChange={onHouseNumberAdditionChange}
          onBlur={onBlur}
          placeholder="A"
          maxLength={10}
          disabled={disabled}
          hasError={false}
        />
      </div>

      {/* Row 2: street */}
      <div style={{ marginBottom: '12px' }}>
        <SubField
          id={streetId}
          label="Street"
          value={street}
          onChange={onStreetChange}
          onBlur={onBlur}
          placeholder="Hoofdstraat"
          disabled={disabled}
          hasError={hasError}
          autoComplete="address-line2"
        />
      </div>

      {/* Row 3: city */}
      <div>
        <SubField
          id={cityId}
          label="City"
          value={city}
          onChange={onCityChange}
          onBlur={onBlur}
          placeholder="Amsterdam"
          disabled={disabled}
          hasError={hasError}
          autoComplete="address-level2"
        />
      </div>

      {(hint || error || lookup.status === 'not-found' || lookup.status === 'error') && (
        <p
          style={{
            margin: '10px 2px 0',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            fontWeight: 400,
            color: hasError ? '#ef4444' : '#9c8b6a',
            lineHeight: 1.4,
          }}
        >
          {error ??
            (lookup.status === 'not-found'
              ? "We couldn't find that postcode — fill in the address manually."
              : lookup.status === 'error'
                ? 'Address lookup is unavailable right now — fill in manually.'
                : hint)}
        </p>
      )}
    </div>
  );
}

// ---- Internal sub-field --------------------------------------------------

function SubField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  inputMode,
  disabled,
  hasError,
  trailingSlot,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
  hasError: boolean;
  trailingSlot?: React.ReactNode;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 18px',
    paddingRight: trailingSlot ? '44px' : '18px',
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
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#9c8b6a',
          marginBottom: '6px',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          style={inputStyle}
        />
        {trailingSlot && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '14px',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {trailingSlot}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Lookup indicator ---------------------------------------------------

function LookupIndicator({ state }: { state: LookupState }) {
  if (state.status === 'idle') return null;

  if (state.status === 'looking-up') {
    return (
      <>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4820a"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ animation: 'pcf-spin 0.9s linear infinite' }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <style>{`@keyframes pcf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </>
    );
  }

  if (state.status === 'found') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3a7d44"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Address found"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9c8b6a"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Address not found"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
