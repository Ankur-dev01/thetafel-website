'use client';

import { useMemo, useState } from 'react';
import {
  isValidDutchBtw,
  isValidDutchPhone,
  isValidEmail,
  isValidWebsite,
} from '@/lib/validation/dutch';
import { useBusinessActions } from '@/lib/dashboard/actions/businessActions';

type EditableFields = {
  display_name: string;
  trade_name: string;
  btw_number: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  cuisine_type: string;
};

type ReadOnlyFields = {
  kvk_number: string;
  legal_name: string;
  legal_form: string;
  sbi_code: string;
  legal_address: string;
};

type Labels = {
  identitySection: string;
  taxSection: string;
  contactSection: string;
  kvkLabel: string;
  legalNameLabel: string;
  legalFormLabel: string;
  sbiCodeLabel: string;
  legalAddressLabel: string;
  readOnlyNote: string;
  supportEmail: string;
  displayNameLabel: string;
  tradeNameLabel: string;
  btwLabel: string;
  btwPlaceholder: string;
  btwInvalid: string;
  btwRequired: string;
  btwLinked: string;
  phoneLabel: string;
  phoneInvalid: string;
  emailLabel: string;
  emailInvalid: string;
  websiteLabel: string;
  websiteInvalid: string;
  cuisineLabel: string;
  save: string;
  saving: string;
  saved: string;
  saveError: string;
  cancel: string;
};

type Props = {
  initial: EditableFields;
  readOnly: ReadOnlyFields;
  labels: Labels;
};

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

export default function BusinessForm({ initial, readOnly, labels }: Props) {
  const { pending, saveBusiness } = useBusinessActions();

  const [baseline, setBaseline] = useState<EditableFields>(initial);
  const [values, setValues] = useState<EditableFields>(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const dirty = (Object.keys(baseline) as (keyof EditableFields)[]).some(
    (k) => values[k] !== baseline[k],
  );

  const btwFieldError = !values.btw_number.trim()
    ? labels.btwRequired
    : !isValidDutchBtw(values.btw_number)
      ? labels.btwInvalid
      : null;
  const phoneFieldError =
    values.contact_phone !== '' && !isValidDutchPhone(values.contact_phone) ? labels.phoneInvalid : null;
  const emailFieldError =
    values.contact_email !== '' && !isValidEmail(values.contact_email) ? labels.emailInvalid : null;
  const websiteFieldError =
    values.website !== '' && !isValidWebsite(values.website) ? labels.websiteInvalid : null;

  const hasErrors =
    values.display_name.trim().length === 0 ||
    !!btwFieldError ||
    !!phoneFieldError ||
    !!emailFieldError ||
    !!websiteFieldError;

  const canSave = dirty && !hasErrors && !pending;

  function update<K extends keyof EditableFields>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSavedToast(false);
  }

  function handleCancel() {
    setValues(baseline);
    setFormError(null);
    setSavedToast(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setFormError(null);
    const payload = { ...values, btw_number: values.btw_number.trim().toUpperCase() };
    const result = await saveBusiness(payload);
    if (result.ok) {
      setBaseline(payload);
      setValues(payload);
      setSavedToast(true);
    } else if (result.code === 'btw_already_linked') {
      setFormError(labels.btwLinked);
    } else {
      setFormError(labels.saveError);
    }
  }

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="business-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {labels.saved}
          </span>
        </div>
      )}

      {/* Read-only legal identity */}
      <section className="bg-white rounded-card p-5 mb-4" data-testid="business-identity-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.identitySection}
        </h2>

        <dl className="mt-4 flex flex-col gap-3 text-[13px]">
          <ReadOnlyRow label={labels.kvkLabel} value={readOnly.kvk_number} />
          <ReadOnlyRow label={labels.legalNameLabel} value={readOnly.legal_name} />
          <ReadOnlyRow label={labels.legalFormLabel} value={readOnly.legal_form} />
          <ReadOnlyRow label={labels.sbiCodeLabel} value={readOnly.sbi_code} />
          <ReadOnlyRow label={labels.legalAddressLabel} value={readOnly.legal_address} />
        </dl>

        <p className="mt-4 text-[12px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.readOnlyNote}{' '}
          <a
            href={`mailto:${labels.supportEmail}`}
            className="text-amber underline underline-offset-2"
          >
            {labels.supportEmail}
          </a>
          .
        </p>
      </section>

      {/* Tax */}
      <section className="bg-white rounded-card p-5 mb-4" data-testid="business-tax-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.taxSection}
        </h2>
        <div className="mt-4">
          <FieldInput
            testId="business-btw"
            label={labels.btwLabel}
            value={values.btw_number}
            onChange={(v) => update('btw_number', v)}
            placeholder={labels.btwPlaceholder}
            maxLength={14}
            error={btwFieldError}
          />
        </div>
      </section>

      {/* Commercial identity + contact */}
      <section className="bg-white rounded-card p-5 mb-4" data-testid="business-contact-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.contactSection}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <FieldInput
            testId="business-display-name"
            label={labels.displayNameLabel}
            value={values.display_name}
            onChange={(v) => update('display_name', v)}
            maxLength={80}
          />
          <FieldInput
            testId="business-trade-name"
            label={labels.tradeNameLabel}
            value={values.trade_name}
            onChange={(v) => update('trade_name', v)}
            maxLength={80}
          />
          <FieldInput
            testId="business-phone"
            label={labels.phoneLabel}
            value={values.contact_phone}
            onChange={(v) => update('contact_phone', v)}
            error={phoneFieldError}
          />
          <FieldInput
            testId="business-email"
            label={labels.emailLabel}
            value={values.contact_email}
            onChange={(v) => update('contact_email', v)}
            error={emailFieldError}
          />
          <FieldInput
            testId="business-website"
            label={labels.websiteLabel}
            value={values.website}
            onChange={(v) => update('website', v)}
            error={websiteFieldError}
          />
          <FieldInput
            testId="business-cuisine"
            label={labels.cuisineLabel}
            value={values.cuisine_type}
            onChange={(v) => update('cuisine_type', v)}
            maxLength={40}
          />
        </div>
      </section>

      {formError && (
        <p className="text-[13px] text-[#b3422f]" data-testid="business-form-error">
          {formError}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="business-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="business-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-x-3">
      <dt className="text-[#6f6353]" style={labelStyle}>
        {label}
      </dt>
      <dd className="text-[#1e1508]" style={bodyStyle}>
        {value}
      </dd>
    </div>
  );
}

function FieldInput({
  testId,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
}: {
  testId: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string | null;
}) {
  return (
    <div>
      <label className="block text-[13px] text-[#1e1508] mb-1" style={labelStyle}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        data-testid={testId}
        className="w-full rounded-lg border border-[#e7ddc9] bg-white px-3 py-2 text-[13px] text-[#1e1508]"
        style={bodyStyle}
      />
      {error && (
        <p className="mt-1 text-[12px] text-[#b3422f]" data-testid={`${testId}-error`} style={labelStyle}>
          {error}
        </p>
      )}
    </div>
  );
}
