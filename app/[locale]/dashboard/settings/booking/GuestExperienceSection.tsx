'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { KNOWN_PLACEHOLDERS } from '@/lib/dashboard/settings/bookingRulesValidation';

type GuestExperienceSectionProps = {
  templateNl: string;
  templateEn: string;
  questionAllergies: boolean;
  questionOccasion: boolean;
  questionRequests: boolean;
  onChangeTemplateNl: (v: string) => void;
  onChangeTemplateEn: (v: string) => void;
  onChangeQuestionAllergies: (v: boolean) => void;
  onChangeQuestionOccasion: (v: boolean) => void;
  onChangeQuestionRequests: (v: boolean) => void;
  disabled: boolean;
  restaurantName: string;
  restaurantAddress: string;
};

const DUMMY_VALUES: Record<string, string> = {
  naam: 'Piet',
  datum: 'vrijdag 15 augustus',
  tijd: '19:30',
  gasten: '4',
};

function renderPreview(template: string, restaurantName: string, restaurantAddress: string): string {
  const values: Record<string, string> = {
    ...DUMMY_VALUES,
    restaurant: restaurantName,
    adres: restaurantAddress || '—',
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, token: string) => values[token] ?? match);
}

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const textareaClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50 min-h-[140px]';

function TemplateField({
  id,
  label,
  value,
  onChange,
  disabled,
  restaurantName,
  restaurantAddress,
  placeholdersLabel,
  previewLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  restaurantName: string;
  restaurantAddress: string;
  placeholdersLabel: string;
  previewLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertToken(token: string) {
    const el = ref.current;
    if (!el) {
      onChange(`${value}{${token}}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}{${token}}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length + 2;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="mb-4">
      <label htmlFor={id} className={labelClass} style={labelStyle}>
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid={`${id}-textarea`}
        className={textareaClass}
        style={bodyStyle}
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {KNOWN_PLACEHOLDERS.map((token) => (
          <button
            key={token}
            type="button"
            onClick={() => insertToken(token)}
            disabled={disabled}
            data-testid={`${id}-chip-${token}`}
            className="tafel-tap px-2 py-1 rounded-full text-[11px] bg-[#f5ede0] text-[#6f6353] disabled:opacity-50"
            style={bodyStyle}
          >
            {`{${token}}`}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-[#8c8577]">{placeholdersLabel}</p>

      <div className="mt-2 rounded-lg bg-[#f7f2e9] p-3">
        <p className={labelClass} style={labelStyle}>
          {previewLabel}
        </p>
        <p
          className="text-[13px] text-[#1e1508] whitespace-pre-wrap"
          style={bodyStyle}
          data-testid={`${id}-preview`}
        >
          {renderPreview(value, restaurantName, restaurantAddress)}
        </p>
      </div>
    </div>
  );
}

export default function GuestExperienceSection({
  templateNl,
  templateEn,
  questionAllergies,
  questionOccasion,
  questionRequests,
  onChangeTemplateNl,
  onChangeTemplateEn,
  onChangeQuestionAllergies,
  onChangeQuestionOccasion,
  onChangeQuestionRequests,
  disabled,
  restaurantName,
  restaurantAddress,
}: GuestExperienceSectionProps) {
  const t = useTranslations('dashboard.settings.booking.guest');
  const placeholdersLabel = t('template.placeholders', { vars: KNOWN_PLACEHOLDERS.map((p) => `{${p}}`).join(', ') });

  return (
    <div className="bg-white rounded-card p-5 mb-4" data-testid="booking-guest-section">
      <h3 className="text-[16px] text-[#1e1508] mb-3" style={labelStyle}>
        {t('sectionTitle')}
      </h3>

      <p className="text-[12px] text-[#8c8577] mb-3">{t('template.help')}</p>

      <TemplateField
        id="booking-template-nl"
        label={t('template.nlLabel')}
        value={templateNl}
        onChange={onChangeTemplateNl}
        disabled={disabled}
        restaurantName={restaurantName}
        restaurantAddress={restaurantAddress}
        placeholdersLabel={placeholdersLabel}
        previewLabel={t('template.previewLabel')}
      />
      <TemplateField
        id="booking-template-en"
        label={t('template.enLabel')}
        value={templateEn}
        onChange={onChangeTemplateEn}
        disabled={disabled}
        restaurantName={restaurantName}
        restaurantAddress={restaurantAddress}
        placeholdersLabel={placeholdersLabel}
        previewLabel={t('template.previewLabel')}
      />

      <div className="mt-2">
        <span className={labelClass} style={labelStyle}>
          {t('questions.label')}
        </span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 tafel-tap">
            <input
              type="checkbox"
              checked={questionAllergies}
              onChange={(e) => onChangeQuestionAllergies(e.target.checked)}
              disabled={disabled}
              data-testid="booking-question-allergies"
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
              {t('questions.allergies')}
            </span>
          </label>
          <label className="flex items-center gap-2 tafel-tap">
            <input
              type="checkbox"
              checked={questionOccasion}
              onChange={(e) => onChangeQuestionOccasion(e.target.checked)}
              disabled={disabled}
              data-testid="booking-question-occasion"
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
              {t('questions.occasion')}
            </span>
          </label>
          <label className="flex items-center gap-2 tafel-tap">
            <input
              type="checkbox"
              checked={questionRequests}
              onChange={(e) => onChangeQuestionRequests(e.target.checked)}
              disabled={disabled}
              data-testid="booking-question-requests"
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
              {t('questions.requests')}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
