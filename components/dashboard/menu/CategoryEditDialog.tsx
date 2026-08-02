'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import CategoryDeleteConfirm from './CategoryDeleteConfirm';
import {
  normalizeCategoryPatch,
  validateCategoryPatch,
  MAX_NAME_LENGTH,
  type CategoryPatch,
  type ValidationError,
} from '@/lib/dashboard/menu/categoryValidation';
import type { MenuCategoryResult } from '@/lib/dashboard/actions/menuCategoryActions';

type CategoryEditDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  /** Edit mode only — the row being edited, plus its item count for the delete guard. */
  initial?: (CategoryPatch & { id: string; itemCount: number }) | null;
  onClose: () => void;
  onSubmit: (patch: CategoryPatch) => Promise<MenuCategoryResult>;
  onDelete?: (id: string) => Promise<MenuCategoryResult>;
  pending: boolean;
};

const EMPTY_PATCH: CategoryPatch = {
  name_nl: '',
  name_en: null,
  window_start: null,
  window_end: null,
  visible_takeaway: true,
  visible_qr: true,
};

/** `time` columns arrive as 'HH:MM:SS'; the <input type="time"> and the API both speak 'HH:MM'. */
function toInputTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '';
}

export default function CategoryEditDialog({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
  pending,
}: CategoryEditDialogProps) {
  const t = useTranslations('dashboard.menu.category');

  const [nameNl, setNameNl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [windowOpen, setWindowOpen] = useState(false);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [visibleQr, setVisibleQr] = useState(true);
  const [visibleTakeaway, setVisibleTakeaway] = useState(true);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Reset every field whenever the dialog (re)opens, so a cancelled edit never
  // leaks into the next one.
  useEffect(() => {
    if (!open) return;
    const base = mode === 'edit' && initial ? initial : EMPTY_PATCH;
    setNameNl(base.name_nl);
    setNameEn(base.name_en ?? '');
    const start = toInputTime(base.window_start);
    const end = toInputTime(base.window_end);
    setWindowStart(start);
    setWindowEnd(end);
    setWindowOpen(Boolean(start || end));
    setVisibleQr(base.visible_qr);
    setVisibleTakeaway(base.visible_takeaway);
    setErrors([]);
    setFormError(null);
    setDeleteOpen(false);
  }, [open, mode, initial]);

  if (!open) return null;

  function currentPatch(): CategoryPatch {
    return normalizeCategoryPatch({
      name_nl: nameNl,
      name_en: nameEn,
      // A collapsed window section means "no window", whatever is still typed in the inputs.
      window_start: windowOpen ? windowStart : null,
      window_end: windowOpen ? windowEnd : null,
      visible_takeaway: visibleTakeaway,
      visible_qr: visibleQr,
    });
  }

  function errorFor(field: string): string | null {
    const hit = errors.find((e) => e.field === field);
    return hit ? t(`error.${hit.code}`) : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const patch = currentPatch();
    const clientErrors = validateCategoryPatch(patch);
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    setErrors([]);
    setFormError(null);
    const result = await onSubmit(patch);
    if (result.ok) {
      onClose();
    } else if (result.errors && result.errors.length > 0) {
      setErrors(result.errors);
    } else {
      setFormError(result.code);
    }
  }

  async function handleDeleteConfirm() {
    if (!initial || !onDelete) return;
    const result = await onDelete(initial.id);
    if (result.ok) {
      setDeleteOpen(false);
      onClose();
    } else {
      setDeleteOpen(false);
      setFormError(result.code);
    }
  }

  const labelClass = 'block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1';
  const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
  const inputClass =
    'w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber';
  const inputStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
  const errorClass = 'mt-1 text-[12px] text-[#b3422f]';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
        <div className="absolute inset-0 bg-black/40" onClick={pending ? undefined : onClose} aria-hidden="true" />
        <form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'create' ? t('create.title') : t('edit.title')}
          data-testid="category-edit-dialog"
          className="relative bg-cream md:bg-white md:rounded-card w-full h-full md:h-auto md:max-w-[520px] md:max-h-[85vh] flex flex-col shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
        >
          <div className="px-5 py-4">
            <h2
              className="text-[19px] text-[#1e1508]"
              style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
            >
              {mode === 'create' ? t('create.title') : t('edit.title')}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-4">
            <div>
              <label htmlFor="category-name-nl" className={labelClass} style={labelStyle}>
                {t('field.nameNl.label')}
              </label>
              <input
                id="category-name-nl"
                type="text"
                value={nameNl}
                onChange={(e) => setNameNl(e.target.value.slice(0, MAX_NAME_LENGTH + 1))}
                placeholder={t('field.nameNl.placeholder')}
                disabled={pending}
                autoFocus
                className={inputClass}
                style={inputStyle}
              />
              {errorFor('name_nl') && <p className={errorClass}>{errorFor('name_nl')}</p>}
            </div>

            <div>
              <label htmlFor="category-name-en" className={labelClass} style={labelStyle}>
                {t('field.nameEn.label')}
              </label>
              <input
                id="category-name-en"
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value.slice(0, MAX_NAME_LENGTH + 1))}
                placeholder={t('field.nameEn.placeholder')}
                disabled={pending}
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.nameEn.hint')}</p>
              {errorFor('name_en') && <p className={errorClass}>{errorFor('name_en')}</p>}
            </div>

            <div>
              <label className="flex items-center gap-2 tafel-tap">
                <input
                  type="checkbox"
                  checked={windowOpen}
                  onChange={(e) => setWindowOpen(e.target.checked)}
                  disabled={pending}
                  data-testid="category-window-toggle"
                  className="w-4 h-4 accent-amber"
                />
                <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
                  {t('field.window.toggle')}
                </span>
              </label>
              {windowOpen && (
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="category-window-start" className={labelClass} style={labelStyle}>
                      {t('field.window.start')}
                    </label>
                    <input
                      id="category-window-start"
                      type="time"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                      disabled={pending}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="category-window-end" className={labelClass} style={labelStyle}>
                      {t('field.window.end')}
                    </label>
                    <input
                      id="category-window-end"
                      type="time"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                      disabled={pending}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.window.hint')}</p>
              {errorFor('window') && <p className={errorClass}>{errorFor('window')}</p>}
            </div>

            <div>
              <span className={labelClass} style={labelStyle}>
                {t('field.visibility.title')}
              </span>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 tafel-tap">
                  <input
                    type="checkbox"
                    checked={visibleQr}
                    onChange={(e) => setVisibleQr(e.target.checked)}
                    disabled={pending}
                    data-testid="category-visible-qr"
                    className="w-4 h-4 accent-amber"
                  />
                  <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
                    {t('field.visibility.qr')}
                  </span>
                </label>
                <label className="flex items-center gap-2 tafel-tap">
                  <input
                    type="checkbox"
                    checked={visibleTakeaway}
                    onChange={(e) => setVisibleTakeaway(e.target.checked)}
                    disabled={pending}
                    data-testid="category-visible-takeaway"
                    className="w-4 h-4 accent-amber"
                  />
                  <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
                    {t('field.visibility.takeaway')}
                  </span>
                </label>
              </div>
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.visibility.hint')}</p>
            </div>

            {formError && (
              <p className="text-[13px] text-[#b3422f]" data-testid="category-form-error">
                {t(`error.${formError}`)}
              </p>
            )}
          </div>

          <div className="px-5 py-4 flex items-center justify-between gap-2 bg-[#f7f2e9] md:rounded-b-card">
            {mode === 'edit' && initial && onDelete ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
                data-testid="category-delete-open"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f] disabled:opacity-50"
                style={labelStyle}
              >
                {t('button.delete')}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
                style={labelStyle}
              >
                {t('button.cancel')}
              </button>
              <button
                type="submit"
                disabled={pending}
                data-testid="category-submit"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={labelStyle}
              >
                {pending ? '…' : mode === 'create' ? t('button.create') : t('button.save')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {mode === 'edit' && initial && onDelete && (
        <CategoryDeleteConfirm
          open={deleteOpen}
          category={{ id: initial.id, name_nl: initial.name_nl }}
          itemCount={initial.itemCount}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          pending={pending}
        />
      )}
    </>
  );
}
