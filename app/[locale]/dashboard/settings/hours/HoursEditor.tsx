'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import HoursDayRow from '@/components/dashboard/settings/HoursDayRow';
import { useHoursActions } from '@/lib/dashboard/actions/hoursActions';
import { PER_SERVICE_SCOPES } from '@/lib/dashboard/settings/hoursValidation';
import type { ServiceScope, DayOfWeek, AvailabilityRow, HoursSavePayload } from '@/lib/dashboard/settings/hoursValidation';
import type { DayConfig, HoursEditorInitialData } from '@/lib/dashboard/queries/availability';

type WeekByScope = Record<ServiceScope, Record<DayOfWeek, DayConfig>>;

type Baseline = {
  hoursPerServiceOverride: boolean;
  days: WeekByScope;
};

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

function cloneDays(days: WeekByScope): WeekByScope {
  return JSON.parse(JSON.stringify(days));
}

export default function HoursEditor({ initialData }: { initialData: HoursEditorInitialData }) {
  const t = useTranslations('dashboard.settings.hours');
  const { pending, saveHours } = useHoursActions();

  const [baseline, setBaseline] = useState<Baseline>({
    hoursPerServiceOverride: initialData.hoursPerServiceOverride,
    days: cloneDays(initialData.days),
  });
  const [override, setOverride] = useState(initialData.hoursPerServiceOverride);
  const [days, setDays] = useState<WeekByScope>(() => cloneDays(initialData.days));
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const activeScopes: ServiceScope[] = override ? PER_SERVICE_SCOPES : ['all'];

  const dirty =
    override !== baseline.hoursPerServiceOverride || JSON.stringify(days) !== JSON.stringify(baseline.days);

  const rowErrors: Record<string, string> = {};
  const scopeErrors: Partial<Record<ServiceScope, string>> = {};

  for (const scope of activeScopes) {
    let enabledCount = 0;
    for (const day of DAYS) {
      const cfg = days[scope][day];
      if (!cfg.enabled) continue;
      enabledCount++;
      const key = `${scope}:${day}`;
      if (cfg.openTime === '' || cfg.closeTime === '') {
        rowErrors[key] = 'invalidTime';
      } else if (cfg.openTime === cfg.closeTime) {
        rowErrors[key] = 'closeEqualsOpen';
      }
    }
    if (override && enabledCount === 0) {
      scopeErrors[scope] = 'scopeEmpty';
    }
  }

  const hasErrors = Object.keys(rowErrors).length > 0 || Object.keys(scopeErrors).length > 0;
  const canSave = dirty && !hasErrors && !pending;

  function updateDay(scope: ServiceScope, day: DayOfWeek, next: DayConfig) {
    setDays((prev) => ({ ...prev, [scope]: { ...prev[scope], [day]: next } }));
    setSavedToast(false);
  }

  function handleOverrideToggle(next: boolean) {
    if (!next && override) {
      if (!window.confirm(t('confirmSwitchOff'))) return;
    }
    setOverride(next);
    setSavedToast(false);
  }

  function handleCancel() {
    setOverride(baseline.hoursPerServiceOverride);
    setDays(cloneDays(baseline.days));
    setFormError(null);
    setSavedToast(false);
  }

  function buildPayload(): HoursSavePayload {
    const rows: AvailabilityRow[] = [];
    for (const scope of activeScopes) {
      for (const day of DAYS) {
        const cfg = days[scope][day];
        if (!cfg.enabled) continue;
        rows.push({
          day_of_week: day,
          service_scope: scope,
          open_time: cfg.openTime,
          close_time: cfg.closeTime,
          closes_next_day: cfg.closeTime < cfg.openTime,
          tag_brunch: cfg.tagBrunch,
          tag_lunch: cfg.tagLunch,
          tag_dinner: cfg.tagDinner,
        });
      }
    }
    return { hoursPerServiceOverride: override, rows };
  }

  async function handleSave() {
    if (!canSave) return;
    setFormError(null);
    const result = await saveHours(buildPayload());
    if (result.ok) {
      setBaseline({ hoursPerServiceOverride: override, days: cloneDays(days) });
      setSavedToast(true);
    } else {
      setFormError('saveFailed');
    }
  }

  const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
  const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

  function renderCard(scope: ServiceScope) {
    return (
      <div key={scope} className="bg-white rounded-card p-5 mb-4" data-testid={`hours-card-${scope}`}>
        <h3 className="text-[16px] text-[#1e1508] mb-1" style={labelStyle}>
          {t(`cards.${scope}`)}
        </h3>
        <div>
          {DAYS.map((day) => (
            <HoursDayRow
              key={day}
              label={t(`days.${day}`)}
              config={days[scope][day]}
              onChange={(next) => updateDay(scope, day, next)}
              disabled={pending}
              error={rowErrors[`${scope}:${day}`] ? t(`errors.${rowErrors[`${scope}:${day}`]}`) : null}
              testIdPrefix={`hours-row-${scope}-${day}`}
              closedLabel={t('row.closed')}
              openLabel={t('row.openTime')}
              closeLabel={t('row.closeTime')}
              closesNextDayLabel={t('row.closesNextDay')}
              tagBrunchLabel={t('row.tagBrunch')}
              tagLunchLabel={t('row.tagLunch')}
              tagDinnerLabel={t('row.tagDinner')}
            />
          ))}
        </div>
        {scopeErrors[scope] && (
          <p className="mt-2 text-[12px] text-[#b3422f]" data-testid={`hours-scope-error-${scope}`}>
            {t(`errors.${scopeErrors[scope]}`)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="hours-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {t('savedToast')}
          </span>
        </div>
      )}

      <div className="bg-white rounded-card p-5 mb-4">
        <label className="flex items-center gap-2 tafel-tap">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => handleOverrideToggle(e.target.checked)}
            disabled={pending}
            data-testid="hours-override-toggle"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={labelStyle}>
            {t('perServiceOverride.label')}
          </span>
        </label>
        <p className="mt-1.5 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {t('perServiceOverride.help')}
        </p>
      </div>

      {activeScopes.map((scope) => renderCard(scope))}

      {formError && (
        <p className="text-[13px] text-[#b3422f]" data-testid="hours-form-error">
          {t(`errors.${formError}`)}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="hours-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="hours-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </div>
  );
}
