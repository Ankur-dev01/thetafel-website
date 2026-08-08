'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { PREPAID_THRESHOLD_OPTIONS } from '@/lib/dashboard/settings/bookingRulesValidation';

type NoShowSectionProps = {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  reconfirmationEnabled: boolean;
  prepaidEnabled: boolean;
  prepaidAmountCents: number | null;
  prepaidThreshold: number | null;
  isPremiumTier: boolean;
  mollieVerified: boolean;
  hasAdvancedPrepaidWindow: boolean;
  onChangeEmail: (v: boolean) => void;
  onChangeWhatsapp: (v: boolean) => void;
  onChangeReconfirmation: (v: boolean) => void;
  onChangePrepaidEnabled: (v: boolean) => void;
  onChangePrepaidAmountCents: (v: number | null) => void;
  onChangePrepaidThreshold: (v: number) => void;
  disabled: boolean;
};

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const selectClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50';

export default function NoShowSection({
  emailEnabled,
  whatsappEnabled,
  reconfirmationEnabled,
  prepaidEnabled,
  prepaidAmountCents,
  prepaidThreshold,
  isPremiumTier,
  mollieVerified,
  hasAdvancedPrepaidWindow,
  onChangeEmail,
  onChangeWhatsapp,
  onChangeReconfirmation,
  onChangePrepaidEnabled,
  onChangePrepaidAmountCents,
  onChangePrepaidThreshold,
  disabled,
}: NoShowSectionProps) {
  const t = useTranslations('dashboard.settings.booking.noshow');
  const euros = prepaidAmountCents === null ? '' : (prepaidAmountCents / 100).toFixed(2);

  function handleAmountChange(value: string) {
    if (value.trim() === '') {
      onChangePrepaidAmountCents(null);
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;
    onChangePrepaidAmountCents(Math.round(parsed * 100));
  }

  return (
    <div className="bg-white rounded-card p-5 mb-4" data-testid="booking-noshow-section">
      <h3 className="text-[16px] text-[#1e1508] mb-3" style={labelStyle}>
        {t('sectionTitle')}
      </h3>

      <label className="flex items-center gap-2 tafel-tap mb-1">
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(e) => onChangeEmail(e.target.checked)}
          disabled={disabled}
          data-testid="booking-noshow-email"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('email.label')}
        </span>
      </label>
      <p className="mt-[-2px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('email.help')}</p>

      <label className="flex items-center gap-2 tafel-tap mb-1">
        <input
          type="checkbox"
          checked={whatsappEnabled}
          onChange={(e) => onChangeWhatsapp(e.target.checked)}
          disabled={disabled || !isPremiumTier}
          data-testid="booking-noshow-whatsapp"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('whatsapp.label')}
        </span>
      </label>
      <p className="mt-[-2px] mb-1 ml-6 text-[12px] text-[#8c8577]">{t('whatsapp.help')}</p>
      {!isPremiumTier && (
        <p className="mb-3 ml-6 text-[12px] text-[#b3422f]" data-testid="booking-noshow-whatsapp-premium-note">
          {t('whatsappNeedsPremium')}
        </p>
      )}
      {isPremiumTier && <div className="mb-3" />}

      <label className="flex items-center gap-2 tafel-tap mb-1">
        <input
          type="checkbox"
          checked={reconfirmationEnabled}
          onChange={(e) => onChangeReconfirmation(e.target.checked)}
          disabled={disabled}
          data-testid="booking-noshow-reconfirmation"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('reconfirmation.label')}
        </span>
      </label>
      <p className="mt-[-2px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('reconfirmation.help')}</p>

      <label className="flex items-center gap-2 tafel-tap mb-1">
        <input
          type="checkbox"
          checked={prepaidEnabled}
          onChange={(e) => onChangePrepaidEnabled(e.target.checked)}
          disabled={disabled || !mollieVerified}
          data-testid="booking-noshow-prepaid"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('prepaid.label')}
        </span>
      </label>
      <p className="mt-[-2px] mb-1 ml-6 text-[12px] text-[#8c8577]">{t('prepaid.help')}</p>
      {!mollieVerified && (
        <p className="mb-3 ml-6 text-[12px] text-[#b3422f]" data-testid="booking-noshow-prepaid-mollie-note">
          <Link href="/dashboard/settings/payments">{t('prepaidNeedsMollie')}</Link>
        </p>
      )}

      {prepaidEnabled && mollieVerified && (
        <div className="ml-6 mb-3 flex items-end gap-4 flex-wrap">
          <div>
            <label htmlFor="booking-prepaid-amount" className={labelClass} style={labelStyle}>
              {t('prepaid.amountLabel')}
            </label>
            <input
              id="booking-prepaid-amount"
              type="number"
              min={1}
              step={0.5}
              inputMode="decimal"
              value={euros}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={disabled}
              data-testid="booking-prepaid-amount"
              className="w-28 rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50"
              style={bodyStyle}
            />
          </div>
          <div>
            <label htmlFor="booking-prepaid-threshold" className={labelClass} style={labelStyle}>
              {t('prepaid.thresholdLabel')}
            </label>
            <select
              id="booking-prepaid-threshold"
              value={prepaidThreshold ?? 1}
              onChange={(e) => onChangePrepaidThreshold(Number(e.target.value))}
              disabled={disabled}
              data-testid="booking-prepaid-threshold"
              className={selectClass}
              style={bodyStyle}
            >
              {PREPAID_THRESHOLD_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 1 ? t('prepaid.thresholdEvery') : value}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {prepaidEnabled && hasAdvancedPrepaidWindow && (
        <p className="ml-6 text-[12px] text-[#8c8577]" data-testid="booking-prepaid-advanced-note">
          {t('prepaid.advancedNote')}
        </p>
      )}
    </div>
  );
}
