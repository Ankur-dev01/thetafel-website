'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plate } from '@/components/dashboard/icons';
import VatPicker from './VatPicker';
import TagPicker from './TagPicker';
import VariantEditor from './VariantEditor';
import ItemDeleteConfirm from './ItemDeleteConfirm';
import PhotoUploadDialog from './PhotoUploadDialog';
import PhotoDeleteConfirm from './PhotoDeleteConfirm';
import { useMenuItemActions } from '@/lib/dashboard/actions/menuItemActions';
import {
  validateItemPatch,
  normalizeItemPatch,
  parsePriceInput,
  formatPriceInput,
  MAX_ITEM_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  type ItemPatch,
  type ValidationError,
} from '@/lib/dashboard/menu/itemValidation';
import { normalizeDietaryTags } from '@/lib/dashboard/menu/normalizeTags';
import { VAT_LOW_BP } from '@/lib/dashboard/menu/vatRates';
import type { MenuItemResult } from '@/lib/dashboard/actions/menuItemActions';
import type { MenuCategory, MenuItemDetail } from '@/lib/dashboard/queries/menu';

type ItemEditDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  categories: MenuCategory[];
  /** Create mode: which category the grid is currently showing, pre-selected. */
  defaultCategoryId?: string | null;
  /** Edit mode: the full item, including variants. */
  item?: MenuItemDetail | null;
  onClose: () => void;
  onSubmit: (patch: ItemPatch) => Promise<MenuItemResult>;
  onDelete?: (id: string) => Promise<MenuItemResult>;
  onVariantsChanged: () => void;
  pending: boolean;
};

export default function ItemEditDialog({
  open,
  mode,
  categories,
  defaultCategoryId,
  item,
  onClose,
  onSubmit,
  onDelete,
  onVariantsChanged,
  pending,
}: ItemEditDialogProps) {
  const t = useTranslations('dashboard.menu.item');

  const [categoryId, setCategoryId] = useState('');
  const [nameNl, setNameNl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionNl, setDescriptionNl] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [price, setPrice] = useState('');
  const [vatRateBp, setVatRateBp] = useState<number>(VAT_LOW_BP);
  const [tags, setTags] = useState<string[]>([]);
  const [visibleQr, setVisibleQr] = useState(true);
  const [visibleTakeaway, setVisibleTakeaway] = useState(true);
  const [available, setAvailable] = useState(true);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [photoDeleteOpen, setPhotoDeleteOpen] = useState(false);
  const { deletePhoto, pending: photoPending } = useMenuItemActions();

  // Reset on every open so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && item) {
      setCategoryId(item.categoryId ?? '');
      setNameNl(item.nameNl);
      setNameEn(item.nameEn ?? '');
      setDescriptionNl(item.descriptionNl ?? '');
      setDescriptionEn(item.descriptionEn ?? '');
      setPrice(formatPriceInput(item.priceCents));
      setVatRateBp(item.vatRateBp);
      setTags(item.dietaryTags);
      setVisibleQr(item.visibleQr);
      setVisibleTakeaway(item.visibleTakeaway);
      setAvailable(item.available);
    } else {
      setCategoryId(defaultCategoryId ?? categories[0]?.id ?? '');
      setNameNl('');
      setNameEn('');
      setDescriptionNl('');
      setDescriptionEn('');
      setPrice('');
      setVatRateBp(VAT_LOW_BP);
      setTags([]);
      setVisibleQr(true);
      setVisibleTakeaway(true);
      setAvailable(true);
    }
    setVariantsOpen(false);
    setErrors([]);
    setFormError(null);
    setDeleteOpen(false);
  }, [open, mode, item, defaultCategoryId, categories]);

  if (!open) return null;

  function currentPatch(): ItemPatch | null {
    const cents = parsePriceInput(price);
    if (cents === null) return null;
    return normalizeItemPatch({
      category_id: categoryId,
      name_nl: nameNl,
      name_en: nameEn,
      description_nl: descriptionNl,
      description_en: descriptionEn,
      price_cents: cents,
      vat_rate_bp: vatRateBp,
      dietary_tags: normalizeDietaryTags(tags),
      visible_takeaway: visibleTakeaway,
      visible_qr: visibleQr,
      available,
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
    if (!patch) {
      setErrors([{ field: 'price_cents', code: 'price_not_integer' }]);
      return;
    }

    const clientErrors = validateItemPatch(patch);
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    setErrors([]);
    setFormError(null);
    const result = await onSubmit(patch);
    if (result.ok) onClose();
    else if (result.errors && result.errors.length > 0) setErrors(result.errors);
    else setFormError(result.code);
  }

  async function handleDeleteConfirm() {
    if (!item || !onDelete) return;
    const result = await onDelete(item.id);
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
          data-testid="item-edit-dialog"
          className="relative bg-cream md:bg-white md:rounded-card w-full h-full md:h-auto md:max-w-[600px] md:max-h-[88vh] flex flex-col shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
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
              <label htmlFor="item-category" className={labelClass} style={labelStyle}>
                {t('field.category')}
              </label>
              <select
                id="item-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={pending}
                className={inputClass}
                style={inputStyle}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errorFor('category_id') && <p className={errorClass}>{errorFor('category_id')}</p>}
            </div>

            <div>
              <label htmlFor="item-name-nl" className={labelClass} style={labelStyle}>
                {t('field.nameNl')}
              </label>
              <input
                id="item-name-nl"
                type="text"
                value={nameNl}
                onChange={(e) => setNameNl(e.target.value.slice(0, MAX_ITEM_NAME_LENGTH + 1))}
                disabled={pending}
                autoFocus
                className={inputClass}
                style={inputStyle}
              />
              {errorFor('name_nl') && <p className={errorClass}>{errorFor('name_nl')}</p>}
            </div>

            <div>
              <label htmlFor="item-name-en" className={labelClass} style={labelStyle}>
                {t('field.nameEn.label')}
              </label>
              <input
                id="item-name-en"
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value.slice(0, MAX_ITEM_NAME_LENGTH + 1))}
                disabled={pending}
                className={inputClass}
                style={inputStyle}
              />
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.nameEn.hint')}</p>
              {errorFor('name_en') && <p className={errorClass}>{errorFor('name_en')}</p>}
            </div>

            <div>
              <label htmlFor="item-description-nl" className={labelClass} style={labelStyle}>
                {t('field.descriptionNl')}
              </label>
              <textarea
                id="item-description-nl"
                value={descriptionNl}
                onChange={(e) => setDescriptionNl(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH + 1))}
                disabled={pending}
                rows={3}
                className={inputClass + ' resize-none'}
                style={inputStyle}
              />
              <div className="text-right text-[11px] text-[#8c8577] mt-1">
                {descriptionNl.length}/{MAX_DESCRIPTION_LENGTH}
              </div>
              {errorFor('description_nl') && <p className={errorClass}>{errorFor('description_nl')}</p>}
            </div>

            <div>
              <label htmlFor="item-description-en" className={labelClass} style={labelStyle}>
                {t('field.descriptionEn')}
              </label>
              <textarea
                id="item-description-en"
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH + 1))}
                disabled={pending}
                rows={2}
                className={inputClass + ' resize-none'}
                style={inputStyle}
              />
              {errorFor('description_en') && <p className={errorClass}>{errorFor('description_en')}</p>}
            </div>

            <div>
              <label htmlFor="item-price" className={labelClass} style={labelStyle}>
                {t('field.price.label')}
              </label>
              <input
                id="item-price"
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('field.price.placeholder')}
                disabled={pending}
                data-testid="item-price"
                className={inputClass}
                style={inputStyle}
              />
              {(errorFor('price_cents') || errorFor('price_not_integer')) && (
                <p className={errorClass}>{errorFor('price_cents')}</p>
              )}
            </div>

            <VatPicker value={vatRateBp} onChange={setVatRateBp} tags={tags} disabled={pending} />
            {errorFor('vat_rate_bp') && <p className={errorClass}>{errorFor('vat_rate_bp')}</p>}

            <TagPicker value={tags} onChange={setTags} disabled={pending} />
            {errorFor('dietary_tags') && <p className={errorClass}>{errorFor('dietary_tags')}</p>}

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
                    data-testid="item-visible-qr"
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
                    data-testid="item-visible-takeaway"
                    className="w-4 h-4 accent-amber"
                  />
                  <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
                    {t('field.visibility.takeaway')}
                  </span>
                </label>
              </div>
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.visibility.hint')}</p>
            </div>

            <div>
              <label className="flex items-center gap-2 tafel-tap">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  disabled={pending}
                  data-testid="item-available"
                  className="w-4 h-4 accent-amber"
                />
                <span className="text-[14px] text-[#1e1508]" style={inputStyle}>
                  {t('field.available.label')}
                </span>
              </label>
              <p className="mt-1 text-[12px] text-[#8c8577]">{t('field.available.hint')}</p>
            </div>

            <div>
              <span className={labelClass} style={labelStyle}>
                {t('field.photo.title')}
              </span>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-card bg-[#f7f2e9] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {mode === 'edit' && item?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Plate width={24} height={24} className="text-[#c2b594]" aria-hidden="true" />
                  )}
                </div>
                {mode === 'edit' && item ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPhotoUploadOpen(true)}
                      disabled={pending || photoPending}
                      data-testid="item-photo-replace"
                      className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
                      style={labelStyle}
                    >
                      {item.photoUrl ? t('photo.replace') : t('photo.upload.title')}
                    </button>
                    {item.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoDeleteOpen(true)}
                        disabled={pending || photoPending}
                        data-testid="item-photo-delete"
                        className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f] disabled:opacity-50"
                        style={labelStyle}
                      >
                        {t('photo.delete.action')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled
                      data-testid="item-photo-replace-stub"
                      className="tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#8c8577] opacity-60"
                      style={labelStyle}
                    >
                      {t('photo.createMode.disabled')}
                    </button>
                  </div>
                )}
              </div>
              {mode === 'create' && (
                <p className="mt-1 text-[12px] text-[#8c8577]">{t('photo.createMode.hint')}</p>
              )}
            </div>

            {mode === 'edit' && item && (
              <>
                <PhotoUploadDialog
                  open={photoUploadOpen}
                  itemId={item.id}
                  currentPhotoUrl={item.photoUrl}
                  onCancel={() => setPhotoUploadOpen(false)}
                  onUploaded={() => {
                    setPhotoUploadOpen(false);
                    onVariantsChanged();
                  }}
                />
                <PhotoDeleteConfirm
                  open={photoDeleteOpen}
                  itemName={item.name}
                  pending={photoPending}
                  onCancel={() => setPhotoDeleteOpen(false)}
                  onConfirm={async () => {
                    const result = await deletePhoto(item.id);
                    if (result.ok) {
                      setPhotoDeleteOpen(false);
                      onVariantsChanged();
                    }
                  }}
                />
              </>
            )}

            <div className="pt-2 border-t border-[#e7ddc9]">
              {mode === 'create' ? (
                <p className="text-[12px] text-[#8c8577]">{t('variants.saveFirst')}</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setVariantsOpen((v) => !v)}
                    data-testid="item-variants-toggle"
                    className="tafel-tap w-full flex items-center justify-between text-left"
                  >
                    <span className={labelClass + ' mb-0'} style={labelStyle}>
                      {t('variants.section')} — {item?.variants.length ?? 0}
                    </span>
                    <span className="text-[#8c8577] text-[12px]">{variantsOpen ? '−' : '+'}</span>
                  </button>
                  {variantsOpen && item && (
                    <div className="mt-2">
                      <VariantEditor itemId={item.id} variants={item.variants} onChanged={onVariantsChanged} />
                    </div>
                  )}
                </>
              )}
            </div>

            {formError && (
              <p className="text-[13px] text-[#b3422f]" data-testid="item-form-error">
                {t(`error.${formError}`)}
              </p>
            )}
          </div>

          <div className="px-5 py-4 flex items-center justify-between gap-2 bg-[#f7f2e9] md:rounded-b-card">
            {mode === 'edit' && item && onDelete ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
                data-testid="item-delete-open"
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
                data-testid="item-submit"
                className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={labelStyle}
              >
                {pending ? '…' : mode === 'create' ? t('button.create') : t('button.save')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {mode === 'edit' && item && onDelete && (
        <ItemDeleteConfirm
          open={deleteOpen}
          item={{ id: item.id, name: item.name }}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          pending={pending}
        />
      )}
    </>
  );
}
