'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plate } from '@/components/dashboard/icons';
import { useMenuItemActions } from '@/lib/dashboard/actions/menuItemActions';

// Mirrors the server's rules for fast feedback only — the route re-validates
// everything, including sniffing the real bytes, so nothing here is trusted.
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const ERROR_KEYS = new Set([
  'no_file',
  'too_large',
  'bad_mime',
  'mime_mismatch',
  'too_small',
  'bad_aspect_ratio',
  'corrupt',
  'processing_failed',
  'upload_failed',
  'not_found',
  'rate_limited',
  'db_error',
]);

type PhotoUploadDialogProps = {
  open: boolean;
  itemId: string;
  currentPhotoUrl: string | null;
  onCancel: () => void;
  onUploaded: () => void;
};

export default function PhotoUploadDialog({
  open,
  itemId,
  currentPhotoUrl,
  onCancel,
  onUploaded,
}: PhotoUploadDialogProps) {
  const t = useTranslations('dashboard.menu.item.photo');
  const { uploadPhoto, pending } = useMenuItemActions();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URLs leak unless explicitly revoked.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setLocalError(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !pending) onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onCancel]);

  if (!open) return null;

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalError(null);
    const picked = e.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      return;
    }
    if (!ACCEPTED.includes(picked.type)) {
      setFile(null);
      setLocalError('bad_mime');
      return;
    }
    if (picked.size > MAX_SIZE_BYTES) {
      setFile(null);
      setLocalError('too_large');
      return;
    }
    setFile(picked);
  }

  async function handleUpload() {
    if (!file || pending) return;
    setLocalError(null);
    const result = await uploadPhoto(itemId, file);
    if (result.ok) {
      onUploaded();
    } else {
      setLocalError(ERROR_KEYS.has(result.code) ? result.code : 'upload_failed');
    }
  }

  const shownPreview = previewUrl ?? currentPhotoUrl;
  const title = currentPhotoUrl ? t('replace.title') : t('upload.title');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={pending ? undefined : onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        data-testid="photo-upload-dialog"
        className="relative bg-white rounded-card p-5 md:p-6 w-full max-w-[420px] shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
      >
        <h2
          className="text-[19px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {title}
        </h2>

        <div className="mt-4 w-full aspect-square max-h-[220px] rounded-card overflow-hidden bg-[#f7f2e9] flex items-center justify-center">
          {shownPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPreview}
              alt=""
              data-testid="photo-upload-preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Plate width={40} height={40} className="text-[#c2b594]" />
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          onChange={handlePick}
          disabled={pending}
          data-testid="photo-upload-file-input"
          className="mt-4 block w-full text-[13px] text-[#6f6353] file:tafel-tap file:mr-3 file:px-3.5 file:py-2 file:rounded-full file:border-0 file:text-[12px] file:uppercase file:tracking-[0.08em] file:bg-[#f5ede0] file:text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        />

        <p className="mt-2 text-[12px] text-[#8c8577]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>
          {t('hint')}
        </p>

        {localError && (
          <p className="mt-2 text-[13px] text-[#b3422f]" data-testid="photo-upload-error">
            {t(`error.${localError}`)}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={pending || !file}
            data-testid="photo-upload-submit"
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {pending ? t('uploading') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
