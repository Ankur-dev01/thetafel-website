'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOrderingActions } from '@/lib/dashboard/actions/orderingActions';
import {
  PREP_TIME_OPTIONS,
  SLOT_INTERVAL_OPTIONS,
  validateOrderingPayload,
} from '@/lib/dashboard/settings/orderingValidation';
import type { OrderingPayload } from '@/lib/dashboard/settings/orderingValidation';
import type { OrderingInitialData } from '@/lib/dashboard/queries/ordering';

type OrderingEditorProps = {
  initialData: OrderingInitialData;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  min_order_negative: 'errors.minOrderNegative',
  min_order_too_high: 'errors.minOrderTooHigh',
  prep_time_invalid: 'errors.prepTimeInvalid',
  slot_interval_invalid: 'errors.slotIntervalInvalid',
  takeaway_not_enabled: 'errors.takeawayNotEnabled',
  validation_error: 'errors.saveFailed',
  db_error: 'errors.saveFailed',
  network_error: 'errors.saveFailed',
  unknown_error: 'errors.saveFailed',
};

const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const selectClass =
  'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50';

export default function OrderingEditor({ initialData }: OrderingEditorProps) {
  const t = useTranslations('dashboard.settings.ordering');
  const { pending, saveOrdering } = useOrderingActions();

  const [baseline, setBaseline] = useState<OrderingPayload>(initialData.config);
  const [config, setConfig] = useState<OrderingPayload>(initialData.config);
  const [savedToast, setSavedToast] = useState(false);
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);

  if (!initialData.serviceTakeawayEnabled) {
    return (
      <div className="bg-white rounded-card p-5" data-testid="ordering-disabled-card">
        <h3 className="text-[16px] text-[#1e1508] mb-1.5" style={labelStyle}>
          {t('disabledCard.title')}
        </h3>
        <p className="text-[14px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {t('disabledCard.body')}
        </p>
      </div>
    );
  }

  function patch(next: Partial<OrderingPayload>) {
    setConfig((prev) => ({ ...prev, ...next }));
    setSavedToast(false);
    setSaveErrorCode(null);
  }

  const dirty = JSON.stringify(config) !== JSON.stringify(baseline);
  const clientError = validateOrderingPayload(config, { serviceTakeawayEnabled: true });
  const canSave = dirty && !clientError && !pending;
  const displayedErrorCode = saveErrorCode ?? (dirty ? clientError?.code ?? null : null);

  const euros = (config.takeaway_min_order_cents / 100).toFixed(2);
  function handleMinOrderChange(value: string) {
    if (value.trim() === '') {
      patch({ takeaway_min_order_cents: 0 });
      return;
    }
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return;
    patch({ takeaway_min_order_cents: Math.round(parsed * 100) });
  }

  function handleCancel() {
    setConfig(baseline);
    setSavedToast(false);
    setSaveErrorCode(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveErrorCode(null);
    const result = await saveOrdering(config);
    if (result.ok) {
      setBaseline(config);
      setSavedToast(true);
    } else {
      setSaveErrorCode(result.code);
    }
  }

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="ordering-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {t('savedToast')}
          </span>
        </div>
      )}

      <div className="bg-amber/10 border border-amber rounded-card p-5 mb-4" data-testid="ordering-operational-section">
        <h3 className="text-[16px] text-[#1e1508] mb-2" style={labelStyle}>
          {t('operational.sectionTitle')}
        </h3>
        <label className="flex items-center gap-2 tafel-tap">
          <input
            type="checkbox"
            checked={config.takeaway_accepting_orders}
            onChange={(e) => patch({ takeaway_accepting_orders: e.target.checked })}
            disabled={pending}
            data-testid="ordering-accepting-orders"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={labelStyle}>
            {t('operational.toggle.label')}
          </span>
        </label>
        <p className="mt-1 ml-6 text-[12px] text-[#6f6353]">{t('operational.toggle.help')}</p>
      </div>

      <div className="bg-white rounded-card p-5 mb-4" data-testid="ordering-config-section">
        <h3 className="text-[16px] text-[#1e1508] mb-3" style={labelStyle}>
          {t('config.sectionTitle')}
        </h3>

        <div className="mb-4">
          <label htmlFor="ordering-prep-time" className={labelClass} style={labelStyle}>
            {t('config.prepTime.label')}
          </label>
          <select
            id="ordering-prep-time"
            value={config.takeaway_prep_time_minutes}
            onChange={(e) => patch({ takeaway_prep_time_minutes: Number(e.target.value) })}
            disabled={pending}
            data-testid="ordering-prep-time"
            className={selectClass}
            style={bodyStyle}
          >
            {PREP_TIME_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t('config.prepTime.minutes', { count: value })}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-[#8c8577]">{t('config.prepTime.help')}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="ordering-slot-interval" className={labelClass} style={labelStyle}>
            {t('config.slotInterval.label')}
          </label>
          <select
            id="ordering-slot-interval"
            value={config.takeaway_slot_interval_minutes}
            onChange={(e) => patch({ takeaway_slot_interval_minutes: Number(e.target.value) })}
            disabled={pending}
            data-testid="ordering-slot-interval"
            className={selectClass}
            style={bodyStyle}
          >
            {SLOT_INTERVAL_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t('config.prepTime.minutes', { count: value })}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-[#8c8577]">{t('config.slotInterval.help')}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="ordering-min-order" className={labelClass} style={labelStyle}>
            {t('config.minOrder.label')}
          </label>
          <input
            id="ordering-min-order"
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={euros}
            onChange={(e) => handleMinOrderChange(e.target.value)}
            disabled={pending}
            data-testid="ordering-min-order"
            className="w-28 rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50"
            style={bodyStyle}
          />
          <p className="mt-1 text-[12px] text-[#8c8577]">{t('config.minOrder.help')}</p>
        </div>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.takeaway_item_notes_allowed}
            onChange={(e) => patch({ takeaway_item_notes_allowed: e.target.checked })}
            disabled={pending}
            data-testid="ordering-item-notes"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.itemNotes.label')}
          </span>
        </label>
        <p className="mt-[-2px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('config.itemNotes.help')}</p>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.takeaway_scheduled_orders_allowed}
            onChange={(e) => patch({ takeaway_scheduled_orders_allowed: e.target.checked })}
            disabled={pending}
            data-testid="ordering-scheduled-orders"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.scheduledOrders.label')}
          </span>
        </label>
        <p className="mt-[-2px] ml-6 text-[12px] text-[#8c8577]">{t('config.scheduledOrders.help')}</p>
      </div>

      {displayedErrorCode && (
        <p className="text-[13px] text-[#b3422f]" data-testid="ordering-form-error">
          {t(ERROR_CODE_KEYS[displayedErrorCode] ?? 'errors.saveFailed')}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="ordering-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="ordering-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </div>
  );
}
