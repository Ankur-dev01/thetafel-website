'use client';

import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — centered modal with cancel + confirm. `pending` disables
 * both buttons while a mutation is in flight. `destructive` renders the
 * confirm button in the danger tone.
 */

type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  pending?: boolean;
};

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  pending = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={pending ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-white rounded-card p-5 md:p-6 w-full max-w-[420px] shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
      >
        <h2
          className="text-[19px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {title}
        </h2>
        <div
          className="mt-2 text-[14px] text-[#6f6353] leading-relaxed"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {body}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={
              'tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] ' +
              (destructive ? 'bg-[#b3422f] text-[#fdfaf5]' : 'bg-amber text-[#1e1508]')
            }
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {pending ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
