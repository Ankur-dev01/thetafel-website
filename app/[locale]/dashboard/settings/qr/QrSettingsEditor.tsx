'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQrSettingsActions } from '@/lib/dashboard/actions/qrSettingsActions';
import {
  ACCENT_COLOR_RE,
  MENU_LANGUAGE_OPTIONS,
  validateQrSettingsPayload,
} from '@/lib/dashboard/settings/qrSettingsValidation';
import type { QrSettingsPayload } from '@/lib/dashboard/settings/qrSettingsValidation';
import type { QrSettingsInitialData } from '@/lib/dashboard/queries/qrSettings';

type QrSettingsEditorProps = {
  initialData: QrSettingsInitialData;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  accent_color_invalid: 'errors.accentColorInvalid',
  menu_language_invalid: 'errors.menuLanguageInvalid',
  qr_needs_payment_method: 'errors.needsPaymentMethod',
  qr_not_enabled: 'errors.qrNotEnabled',
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

export default function QrSettingsEditor({ initialData }: QrSettingsEditorProps) {
  const t = useTranslations('dashboard.settings.qr');
  const { pending, saveQrSettings } = useQrSettingsActions();

  const [baseline, setBaseline] = useState<QrSettingsPayload>(initialData.config);
  const [config, setConfig] = useState<QrSettingsPayload>(initialData.config);
  const [savedToast, setSavedToast] = useState(false);
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);

  if (!initialData.serviceQrEnabled) {
    return (
      <div className="bg-white rounded-card p-5" data-testid="qr-disabled-card">
        <h3 className="text-[16px] text-[#1e1508] mb-1.5" style={labelStyle}>
          {t('disabledCard.title')}
        </h3>
        <p className="text-[14px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {t('disabledCard.body')}
        </p>
      </div>
    );
  }

  function patch(next: Partial<QrSettingsPayload>) {
    setConfig((prev) => ({ ...prev, ...next }));
    setSavedToast(false);
    setSaveErrorCode(null);
  }

  const dirty = JSON.stringify(config) !== JSON.stringify(baseline);
  const clientError = validateQrSettingsPayload(config, { serviceQrEnabled: true });
  const canSave = dirty && !clientError && !pending;
  const displayedErrorCode = saveErrorCode ?? (dirty ? clientError?.code ?? null : null);

  const accentIsValidHex = ACCENT_COLOR_RE.test(config.qr_widget_accent_color);

  function handleCancel() {
    setConfig(baseline);
    setSavedToast(false);
    setSaveErrorCode(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveErrorCode(null);
    const result = await saveQrSettings(config);
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
          data-testid="qr-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {t('savedToast')}
          </span>
        </div>
      )}

      <div className="bg-white rounded-card p-5 mb-4" data-testid="qr-config-section">
        <h3 className="text-[16px] text-[#1e1508] mb-3" style={labelStyle}>
          {t('config.sectionTitle')}
        </h3>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.qr_auto_accept}
            onChange={(e) => patch({ qr_auto_accept: e.target.checked })}
            disabled={pending}
            data-testid="qr-auto-accept"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.autoAccept.label')}
          </span>
        </label>
        <p className="mt-[-2px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('config.autoAccept.help')}</p>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.qr_item_notes_enabled}
            onChange={(e) => patch({ qr_item_notes_enabled: e.target.checked })}
            disabled={pending}
            data-testid="qr-item-notes"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.itemNotes.label')}
          </span>
        </label>
        <p className="mt-[-2px] mb-4 ml-6 text-[12px] text-[#8c8577]">{t('config.itemNotes.help')}</p>

        <div className="mb-4">
          <label htmlFor="qr-menu-language" className={labelClass} style={labelStyle}>
            {t('config.menuLanguage.label')}
          </label>
          <select
            id="qr-menu-language"
            value={config.qr_menu_language}
            onChange={(e) => patch({ qr_menu_language: e.target.value })}
            disabled={pending}
            data-testid="qr-menu-language"
            className={selectClass}
            style={bodyStyle}
          >
            {MENU_LANGUAGE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`config.menuLanguage.options.${value}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-[#8c8577]">{t('config.menuLanguage.help')}</p>
        </div>

        <div className="mb-4">
          <label htmlFor="qr-accent-color" className={labelClass} style={labelStyle}>
            {t('config.accentColor.label')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accentIsValidHex ? config.qr_widget_accent_color : '#d4820a'}
              onChange={(e) => patch({ qr_widget_accent_color: e.target.value })}
              disabled={pending}
              data-testid="qr-accent-color-picker"
              className="w-10 h-10 rounded-lg border border-[#e7ddc9] p-0.5 disabled:opacity-50"
            />
            <input
              id="qr-accent-color"
              type="text"
              value={config.qr_widget_accent_color}
              onChange={(e) => patch({ qr_widget_accent_color: e.target.value })}
              disabled={pending}
              data-testid="qr-accent-color-hex"
              placeholder="#d4820a"
              className="w-32 rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber disabled:opacity-50"
              style={bodyStyle}
            />
          </div>
          <p className="mt-1 text-[12px] text-[#8c8577]">{t('config.accentColor.help')}</p>
        </div>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.qr_pay_now_enabled}
            onChange={(e) => patch({ qr_pay_now_enabled: e.target.checked })}
            disabled={pending}
            data-testid="qr-pay-now"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.payNow.label')}
          </span>
        </label>
        <p className="mt-[-2px] mb-3 ml-6 text-[12px] text-[#8c8577]">{t('config.payNow.help')}</p>

        <label className="flex items-center gap-2 tafel-tap mb-1">
          <input
            type="checkbox"
            checked={config.qr_pay_at_table_enabled}
            onChange={(e) => patch({ qr_pay_at_table_enabled: e.target.checked })}
            disabled={pending}
            data-testid="qr-pay-at-table"
            className="w-4 h-4 accent-amber"
          />
          <span className="text-[14px] text-[#1e1508]" style={bodyStyle}>
            {t('config.payAtTable.label')}
          </span>
        </label>
        <p className="mt-[-2px] ml-6 text-[12px] text-[#8c8577]">{t('config.payAtTable.help')}</p>
      </div>

      <div className="bg-white rounded-card p-5 mb-4" data-testid="qr-codes-placeholder">
        <h3 className="text-[16px] text-[#1e1508] mb-1.5" style={labelStyle}>
          {t('codes.sectionTitle')}
        </h3>
        <p className="text-[13px] text-[#8c8577]" style={bodyStyle}>
          {t('codes.comingSoonBody')}
        </p>
      </div>

      {displayedErrorCode && (
        <p className="text-[13px] text-[#b3422f]" data-testid="qr-form-error">
          {t(ERROR_CODE_KEYS[displayedErrorCode] ?? 'errors.saveFailed')}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="qr-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="qr-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </div>
  );
}
