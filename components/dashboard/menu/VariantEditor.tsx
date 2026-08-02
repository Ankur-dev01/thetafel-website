'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMenuVariantActions } from '@/lib/dashboard/actions/menuVariantActions';
import {
  parseDeltaInput,
  formatDelta,
  MAX_VARIANT_NAME_LENGTH,
  type ValidationError,
} from '@/lib/dashboard/menu/variantValidation';
import type { MenuItemVariant } from '@/lib/dashboard/queries/menu';

type VariantEditorProps = {
  itemId: string;
  variants: MenuItemVariant[];
  /** Parent re-renders from the server payload after each write. */
  onChanged: () => void;
};

export default function VariantEditor({ itemId, variants, onChanged }: VariantEditorProps) {
  const t = useTranslations('dashboard.menu.item.variants');
  const tError = useTranslations('dashboard.menu.variant.error');
  const actions = useMenuVariantActions();

  const [newName, setNewName] = useState('');
  const [newDelta, setNewDelta] = useState('');
  const [addErrors, setAddErrors] = useState<ValidationError[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDelta, setEditDelta] = useState('');
  const [editErrors, setEditErrors] = useState<ValidationError[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function errorLabel(errors: ValidationError[], field: string): string | null {
    const hit = errors.find((e) => e.field === field);
    return hit ? tError(hit.code) : null;
  }

  async function handleAdd() {
    const cents = parseDeltaInput(newDelta || '0');
    if (cents === null) {
      setAddErrors([{ field: 'price_delta_cents', code: 'price_delta_not_integer' }]);
      return;
    }
    const result = await actions.createVariant(itemId, { name_nl: newName, price_delta_cents: cents });
    if (result.ok) {
      setNewName('');
      setNewDelta('');
      setAddErrors([]);
      onChanged();
    } else {
      setAddErrors(result.errors ?? [{ field: 'name_nl', code: 'variant_name_required' }]);
    }
  }

  function startEdit(variant: MenuItemVariant) {
    setEditingId(variant.id);
    setEditName(variant.name);
    setEditDelta((variant.priceDeltaCents / 100).toFixed(2));
    setEditErrors([]);
  }

  async function handleSaveEdit(variantId: string) {
    const cents = parseDeltaInput(editDelta || '0');
    if (cents === null) {
      setEditErrors([{ field: 'price_delta_cents', code: 'price_delta_not_integer' }]);
      return;
    }
    const result = await actions.updateVariant(itemId, variantId, { name_nl: editName, price_delta_cents: cents });
    if (result.ok) {
      setEditingId(null);
      setEditErrors([]);
      onChanged();
    } else {
      setEditErrors(result.errors ?? [{ field: 'name_nl', code: 'variant_name_required' }]);
    }
  }

  async function handleDelete(variantId: string) {
    const result = await actions.deleteVariant(itemId, variantId);
    if (result.ok) {
      setConfirmDeleteId(null);
      onChanged();
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#e7ddc9] px-2.5 py-1.5 text-[13px] text-[#1e1508] bg-white focus:outline-none focus:ring-2 focus:ring-amber';
  const inputStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
  const smallBtn = 'tafel-tap px-2.5 py-1.5 rounded-full text-[11px] uppercase tracking-[0.08em] disabled:opacity-50';
  const btnStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;

  return (
    <div className="flex flex-col gap-2" data-testid="variant-editor">
      {variants.length === 0 && <p className="text-[12px] text-[#8c8577]">{t('empty')}</p>}

      {variants.map((variant) => (
        <div key={variant.id} className="flex items-center gap-2" data-testid={`variant-row-${variant.id}`}>
          {editingId === variant.id ? (
            <>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value.slice(0, MAX_VARIANT_NAME_LENGTH + 1))}
                disabled={actions.pending}
                aria-label={t('name.placeholder')}
                className={inputClass + ' flex-1'}
                style={inputStyle}
              />
              <input
                value={editDelta}
                onChange={(e) => setEditDelta(e.target.value)}
                disabled={actions.pending}
                aria-label={t('delta.placeholder')}
                className={inputClass + ' w-24'}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => handleSaveEdit(variant.id)}
                disabled={actions.pending}
                data-testid={`variant-save-${variant.id}`}
                className={smallBtn + ' bg-amber text-[#1e1508]'}
                style={btnStyle}
              >
                {t('save')}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                disabled={actions.pending}
                className={smallBtn + ' bg-[#f5ede0] text-[#1e1508]'}
                style={btnStyle}
              >
                {t('cancel')}
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 min-w-0 truncate text-[13px] text-[#1e1508]" style={{ ...inputStyle, fontWeight: 500 }}>
                {variant.name}
              </span>
              <span className="text-[13px] text-[#1e1508] whitespace-nowrap" style={{ ...inputStyle, fontWeight: 600 }}>
                {formatDelta(variant.priceDeltaCents)}
              </span>
              <button
                type="button"
                onClick={() => startEdit(variant)}
                disabled={actions.pending}
                data-testid={`variant-edit-${variant.id}`}
                className={smallBtn + ' bg-[#f5ede0] text-[#1e1508]'}
                style={btnStyle}
              >
                {t('edit')}
              </button>
              {confirmDeleteId === variant.id ? (
                <button
                  type="button"
                  onClick={() => handleDelete(variant.id)}
                  disabled={actions.pending}
                  data-testid={`variant-delete-confirm-${variant.id}`}
                  className={smallBtn + ' bg-[#b3422f] text-[#fdfaf5]'}
                  style={btnStyle}
                >
                  {t('delete.confirm')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(variant.id)}
                  disabled={actions.pending}
                  data-testid={`variant-delete-${variant.id}`}
                  className={smallBtn + ' bg-[#f7e8e6] text-[#b3422f]'}
                  style={btnStyle}
                >
                  {t('delete')}
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {editErrors.length > 0 && (
        <p className="text-[12px] text-[#b3422f]" data-testid="variant-edit-error">
          {errorLabel(editErrors, 'name_nl') ?? errorLabel(editErrors, 'price_delta_cents')}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-[#f0e8d8]">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value.slice(0, MAX_VARIANT_NAME_LENGTH + 1))}
          placeholder={t('name.placeholder')}
          disabled={actions.pending}
          data-testid="variant-new-name"
          className={inputClass + ' flex-1'}
          style={inputStyle}
        />
        <input
          value={newDelta}
          onChange={(e) => setNewDelta(e.target.value)}
          placeholder={t('delta.placeholder')}
          disabled={actions.pending}
          data-testid="variant-new-delta"
          className={inputClass + ' w-32'}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={actions.pending}
          data-testid="variant-add"
          className={smallBtn + ' bg-amber text-[#1e1508] whitespace-nowrap'}
          style={btnStyle}
        >
          {t('add')}
        </button>
      </div>

      {addErrors.length > 0 && (
        <p className="text-[12px] text-[#b3422f]" data-testid="variant-add-error">
          {errorLabel(addErrors, 'name_nl') ?? errorLabel(addErrors, 'price_delta_cents')}
        </p>
      )}
    </div>
  );
}
