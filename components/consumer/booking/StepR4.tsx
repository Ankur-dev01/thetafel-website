// components/consumer/booking/StepR4.tsx
//
// Step 4 — guest details. First form in the flow.
//
// Validation mirrors guestInputSchema from lib/consumer/schemas.ts (server
// source of truth) via the client-safe replica in lib/booking/guestValidation.ts.
// Errors render only after a field is blurred. Continue enables when all three
// required fields (name, email, phone) are valid.
//
// Conditional optional fields (allergies, occasion, requests) are gated on
// config.question* flags. The free-form note field is always shown.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BookingConfig, GuestDraft } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';
import { validateGuestFields } from '@/lib/booking/guestValidation';

interface Props {
  config: BookingConfig;
}

type RequiredField = 'name' | 'email' | 'phone';
type AnyField = RequiredField | 'note' | 'allergies' | 'occasion' | 'requests';

const ERROR_RED = '#b91c1c';
const BORDER_DEFAULT = 'rgba(15, 13, 8, 0.15)';
const BORDER_ERROR = '#b91c1c';
const BORDER_FOCUS_AMBER = 'var(--amber, #d4820a)';

export function StepR4({ config }: Props) {
  const t = useTranslations('booking.r4');
  const { draft, updateGuest, updateDraft, setCanContinue } = useBookingFlow();
  const { guest, marketingConsent } = draft;

  const [touched, setTouched] = useState<Set<AnyField>>(new Set());

  const { valid, errors: fieldErrors } = useMemo(
    () => validateGuestFields(guest.name, guest.email, guest.phone),
    [guest.name, guest.email, guest.phone],
  );

  useEffect(() => {
    setCanContinue(valid);
  }, [valid, setCanContinue]);

  function markTouched(field: AnyField) {
    setTouched((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  function showError(field: RequiredField): boolean {
    return touched.has(field) && Boolean(fieldErrors[field]);
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TextField
          label={t('name_label')}
          required
          name="name"
          value={guest.name}
          onChange={(v) => updateGuest({ name: v })}
          onBlur={() => markTouched('name')}
          error={showError('name') ? t('errors.name_invalid') : undefined}
          autoComplete="name"
        />

        <TextField
          label={t('email_label')}
          required
          name="email"
          type="email"
          value={guest.email}
          onChange={(v) => updateGuest({ email: v })}
          onBlur={() => markTouched('email')}
          error={showError('email') ? t('errors.email_invalid') : undefined}
          autoComplete="email"
          inputMode="email"
        />

        <TextField
          label={t('phone_label')}
          required
          name="phone"
          type="tel"
          value={guest.phone}
          onChange={(v) => updateGuest({ phone: v })}
          onBlur={() => markTouched('phone')}
          error={showError('phone') ? t('errors.phone_invalid') : undefined}
          autoComplete="tel"
          inputMode="tel"
        />

        {config.questionAllergies && (
          <TextAreaField
            label={t('allergies_label')}
            name="allergies"
            value={guest.allergies}
            onChange={(v) => updateGuest({ allergies: v })}
            placeholder={t('optional_placeholder')}
            maxLength={200}
          />
        )}

        {config.questionOccasion && (
          <TextAreaField
            label={t('occasion_label')}
            name="occasion"
            value={guest.occasion}
            onChange={(v) => updateGuest({ occasion: v })}
            placeholder={t('optional_placeholder')}
            maxLength={200}
          />
        )}

        {config.questionRequests && (
          <TextAreaField
            label={t('requests_label')}
            name="requests"
            value={guest.requests}
            onChange={(v) => updateGuest({ requests: v })}
            placeholder={t('optional_placeholder')}
            maxLength={200}
          />
        )}

        <TextAreaField
          label={t('note_label')}
          name="note"
          value={guest.note}
          onChange={(v) => updateGuest({ note: v })}
          placeholder={t('optional_placeholder')}
          maxLength={500}
        />

        {/* Marketing consent */}
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            cursor: 'pointer',
            paddingTop: 4,
          }}
        >
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => updateDraft({ marketingConsent: e.target.checked })}
            style={{
              marginTop: 2,
              width: 16,
              height: 16,
              accentColor: 'var(--amber, #d4820a)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 14,
                fontFamily: 'var(--font-jost), sans-serif',
                color: 'var(--night, #0f0d08)',
              }}
            >
              {t('marketing_label')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-jost), sans-serif',
                color: 'rgba(15, 13, 8, 0.5)',
              }}
            >
              {t('marketing_hint')}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Input components                                                          */
/* -------------------------------------------------------------------------- */

interface TextFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

function TextField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  required,
  type = 'text',
  autoComplete,
  inputMode,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const id = `field-${name}`;
  const hasError = Boolean(error);

  const borderColor = hasError ? BORDER_ERROR : focused ? BORDER_FOCUS_AMBER : BORDER_DEFAULT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(15, 13, 8, 0.6)',
        }}
      >
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        onFocus={() => setFocused(true)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : undefined}
        style={{
          height: 44,
          borderRadius: 6,
          border: `1px solid ${borderColor}`,
          background: '#fff',
          padding: '0 12px',
          fontSize: 14,
          fontFamily: 'var(--font-jost), sans-serif',
          color: 'var(--night, #0f0d08)',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {hasError ? (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-jost), sans-serif',
            color: ERROR_RED,
            margin: 0,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextAreaFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

function TextAreaField({ label, name, value, onChange, placeholder, maxLength }: TextAreaFieldProps) {
  const [focused, setFocused] = useState(false);
  const id = `field-${name}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(15, 13, 8, 0.6)',
        }}
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        style={{
          borderRadius: 6,
          border: `1px solid ${focused ? BORDER_FOCUS_AMBER : BORDER_DEFAULT}`,
          background: '#fff',
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'var(--font-jost), sans-serif',
          color: 'var(--night, #0f0d08)',
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color 0.15s ease',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
