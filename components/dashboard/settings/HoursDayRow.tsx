'use client';

import type { DayConfig } from '@/lib/dashboard/queries/availability';

type HoursDayRowProps = {
  label: string;
  config: DayConfig;
  onChange: (next: DayConfig) => void;
  disabled: boolean;
  error?: string | null;
  testIdPrefix: string;
  closedLabel: string;
  openLabel: string;
  closeLabel: string;
  closesNextDayLabel: string;
  tagBrunchLabel: string;
  tagLunchLabel: string;
  tagDinnerLabel: string;
};

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const inputClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50';
const inputStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

export default function HoursDayRow({
  label,
  config,
  onChange,
  disabled,
  error,
  testIdPrefix,
  closedLabel,
  openLabel,
  closeLabel,
  closesNextDayLabel,
  tagBrunchLabel,
  tagLunchLabel,
  tagDinnerLabel,
}: HoursDayRowProps) {
  const closesNextDay =
    config.enabled && config.openTime !== '' && config.closeTime !== '' && config.closeTime < config.openTime;

  return (
    <div className="py-3 border-b border-[#f0e8d8] last:border-b-0">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 tafel-tap w-[110px] flex-shrink-0">
          <input
            type="checkbox"
            checked={!config.enabled}
            onChange={(e) => onChange({ ...config, enabled: !e.target.checked })}
            disabled={disabled}
            data-testid={`${testIdPrefix}-closed`}
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
            {label}
          </span>
        </label>

        {config.enabled ? (
          <>
            <div className="flex items-center gap-2">
              <div>
                <label className={labelClass} style={labelStyle}>
                  {openLabel}
                </label>
                <input
                  type="time"
                  value={config.openTime}
                  onChange={(e) => onChange({ ...config, openTime: e.target.value })}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-open`}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>
                  {closeLabel}
                </label>
                <input
                  type="time"
                  value={config.closeTime}
                  onChange={(e) => onChange({ ...config, closeTime: e.target.value })}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-close`}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
              {closesNextDay && (
                <span
                  data-testid={`${testIdPrefix}-next-day`}
                  className="text-[11px] uppercase tracking-[0.06em] text-[#8c8577] mt-4"
                  style={labelStyle}
                >
                  {closesNextDayLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <label className="flex items-center gap-1.5 tafel-tap">
                <input
                  type="checkbox"
                  checked={config.tagBrunch}
                  onChange={(e) => onChange({ ...config, tagBrunch: e.target.checked })}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-tag-brunch`}
                  className="w-4 h-4 accent-amber"
                />
                <span className="text-[13px] text-[#6f6353]" style={inputStyle}>
                  {tagBrunchLabel}
                </span>
              </label>
              <label className="flex items-center gap-1.5 tafel-tap">
                <input
                  type="checkbox"
                  checked={config.tagLunch}
                  onChange={(e) => onChange({ ...config, tagLunch: e.target.checked })}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-tag-lunch`}
                  className="w-4 h-4 accent-amber"
                />
                <span className="text-[13px] text-[#6f6353]" style={inputStyle}>
                  {tagLunchLabel}
                </span>
              </label>
              <label className="flex items-center gap-1.5 tafel-tap">
                <input
                  type="checkbox"
                  checked={config.tagDinner}
                  onChange={(e) => onChange({ ...config, tagDinner: e.target.checked })}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-tag-dinner`}
                  className="w-4 h-4 accent-amber"
                />
                <span className="text-[13px] text-[#6f6353]" style={inputStyle}>
                  {tagDinnerLabel}
                </span>
              </label>
            </div>
          </>
        ) : (
          <span className="text-[13px] text-[#8c8577]" style={inputStyle}>
            {closedLabel}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-1 text-[12px] text-[#b3422f]" data-testid={`${testIdPrefix}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
