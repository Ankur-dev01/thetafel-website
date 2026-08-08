'use client';

import { useTranslations } from 'next-intl';
import {
  MIN_LEAD_TIME_OPTIONS,
  MAX_PARTY_SIZE_ONLINE_OPTIONS,
  BOOKING_WINDOW_OPTIONS,
} from '@/lib/dashboard/settings/bookingRulesValidation';

type BookingRulesSectionProps = {
  minLeadTimeMinutes: number;
  maxPartySizeOnline: number | null;
  bookingWindowDays: number;
  maxGuestsPerSlot: number | null;
  waitlistEnabled: boolean;
  guestZoneChoiceEnabled: boolean;
  onChangeMinLeadTime: (v: number) => void;
  onChangeMaxPartySize: (v: number | null) => void;
  onChangeBookingWindow: (v: number) => void;
  onChangeMaxGuestsPerSlot: (v: number | null) => void;
  onChangeWaitlist: (v: boolean) => void;
  onChangeZoneChoice: (v: boolean) => void;
  disabled: boolean;
};

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const selectClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50';

export default function BookingRulesSection({
  minLeadTimeMinutes,
  maxPartySizeOnline,
  bookingWindowDays,
  maxGuestsPerSlot,
  waitlistEnabled,
  guestZoneChoiceEnabled,
  onChangeMinLeadTime,
  onChangeMaxPartySize,
  onChangeBookingWindow,
  onChangeMaxGuestsPerSlot,
  onChangeWaitlist,
  onChangeZoneChoice,
  disabled,
}: BookingRulesSectionProps) {
  const t = useTranslations('dashboard.settings.booking.rules');

  return (
    <div className="bg-white rounded-card p-5 mb-4" data-testid="booking-rules-section">
      <h3 className="text-[16px] text-[#1e1508] mb-3" style={labelStyle}>
        {t('sectionTitle')}
      </h3>

      <div className="mb-4">
        <label htmlFor="booking-min-lead-time" className={labelClass} style={labelStyle}>
          {t('minLeadTime.label')}
        </label>
        <select
          id="booking-min-lead-time"
          value={minLeadTimeMinutes}
          onChange={(e) => onChangeMinLeadTime(Number(e.target.value))}
          disabled={disabled}
          data-testid="booking-min-lead-time"
          className={selectClass}
          style={bodyStyle}
        >
          {MIN_LEAD_TIME_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t(`minLeadTime.options.${value === 0 ? 'off' : value}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] text-[#8c8577]">{t('minLeadTime.help')}</p>
      </div>

      <div className="mb-4">
        <label htmlFor="booking-max-party-size" className={labelClass} style={labelStyle}>
          {t('maxPartySize.label')}
        </label>
        <select
          id="booking-max-party-size"
          value={maxPartySizeOnline === null ? 'null' : maxPartySizeOnline}
          onChange={(e) => onChangeMaxPartySize(e.target.value === 'null' ? null : Number(e.target.value))}
          disabled={disabled}
          data-testid="booking-max-party-size"
          className={selectClass}
          style={bodyStyle}
        >
          {MAX_PARTY_SIZE_ONLINE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
          <option value="null">{t('maxPartySize.noLimit')}</option>
        </select>
        <p className="mt-1 text-[12px] text-[#8c8577]">{t('maxPartySize.help')}</p>
      </div>

      <div className="mb-4">
        <label htmlFor="booking-window-days" className={labelClass} style={labelStyle}>
          {t('bookingWindow.label')}
        </label>
        <select
          id="booking-window-days"
          value={bookingWindowDays}
          onChange={(e) => onChangeBookingWindow(Number(e.target.value))}
          disabled={disabled}
          data-testid="booking-window-days"
          className={selectClass}
          style={bodyStyle}
        >
          {BOOKING_WINDOW_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t('bookingWindow.days', { count: value })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] text-[#8c8577]">{t('bookingWindow.help')}</p>
      </div>

      <div className="mb-4">
        <span className={labelClass} style={labelStyle}>
          {t('maxGuestsPerSlot.label')}
        </span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 tafel-tap">
            <input
              type="radio"
              name="max-guests-per-slot"
              checked={maxGuestsPerSlot === null}
              onChange={() => onChangeMaxGuestsPerSlot(null)}
              disabled={disabled}
              data-testid="booking-max-guests-per-slot-none"
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
              {t('maxGuestsPerSlot.noLimit')}
            </span>
          </label>
          <label className="flex items-center gap-2 tafel-tap">
            <input
              type="radio"
              name="max-guests-per-slot"
              checked={maxGuestsPerSlot !== null}
              onChange={() => onChangeMaxGuestsPerSlot(maxGuestsPerSlot ?? 20)}
              disabled={disabled}
              data-testid="booking-max-guests-per-slot-limit"
              className="w-4 h-4 accent-amber"
            />
            <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
              {t('maxGuestsPerSlot.limitLabel')}
            </span>
          </label>
          {maxGuestsPerSlot !== null && (
            <input
              type="number"
              min={2}
              max={500}
              value={maxGuestsPerSlot}
              onChange={(e) => onChangeMaxGuestsPerSlot(Number(e.target.value))}
              disabled={disabled}
              data-testid="booking-max-guests-per-slot-value"
              className="w-20 rounded-lg border border-[#e7ddc9] px-2 py-1.5 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50"
              style={bodyStyle}
            />
          )}
        </div>
        <p className="mt-1 text-[12px] text-[#8c8577]">{t('maxGuestsPerSlot.help')}</p>
      </div>

      <label className="flex items-center gap-2 tafel-tap mb-2">
        <input
          type="checkbox"
          checked={waitlistEnabled}
          onChange={(e) => onChangeWaitlist(e.target.checked)}
          disabled={disabled}
          data-testid="booking-waitlist-enabled"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('waitlist.label')}
        </span>
      </label>
      <p className="mt-[-4px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('waitlist.help')}</p>

      <label className="flex items-center gap-2 tafel-tap">
        <input
          type="checkbox"
          checked={guestZoneChoiceEnabled}
          onChange={(e) => onChangeZoneChoice(e.target.checked)}
          disabled={disabled}
          data-testid="booking-zone-choice-enabled"
          className="w-4 h-4 accent-amber"
        />
        <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
          {t('zoneChoice.label')}
        </span>
      </label>
      <p className="mt-1 ml-6 text-[12px] text-[#8c8577]">{t('zoneChoice.help')}</p>
    </div>
  );
}
