'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { BookableZoneOption } from '@/lib/dashboard/bookings/types';
import { useWalkInCreate, type WalkInResult } from '@/lib/dashboard/actions/bookingActions';

type WalkInDialogProps = {
  open: boolean;
  onClose: () => void;
  onViewBooking: (bookingId: string) => void;
  zones: BookableZoneOption[];
  locale: 'nl' | 'en';
};

const MAX_NAME_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;
const MIN_PARTY_SIZE = 1;
const MAX_PARTY_SIZE = 30;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 360;

const ERROR_KEYS = new Set([
  'invalid_body',
  'party_size_out_of_range',
  'invalid_phone',
  'zone_or_table_mismatch',
  'over_capacity',
  'half_full_violated',
  'table_conflict',
  'slot_lock_timeout',
  'rate_limited',
]);

export default function WalkInDialog({ open, onClose, onViewBooking, zones, locale }: WalkInDialogProps) {
  const t = useTranslations('dashboard.walkin');
  const { pending, create } = useWalkInCreate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? '');
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [customDuration, setCustomDuration] = useState(false);
  const [duration, setDuration] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<WalkInResult & { ok: true } | null>(null);
  const [successName, setSuccessName] = useState<string>('');

  const selectedZone = zones.find((z) => z.id === zoneId) ?? null;

  function toggleTable(tableId: string) {
    setTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
  }

  const totalSeats = useMemo(
    () => tableIds.reduce((sum, id) => sum + (selectedZone?.tables.find((t) => t.id === id)?.seats ?? 0), 0),
    [tableIds, selectedZone],
  );

  const seatsHint = useMemo(() => {
    if (tableIds.length === 0) return null;
    if (partySize > totalSeats || partySize * 2 < totalSeats) {
      return { tooMuch: true, text: t('field.tables.tooMuchRoom') };
    }
    return { tooMuch: false, text: t('field.tables.seatsOver', { n: totalSeats - partySize }) };
  }, [tableIds.length, partySize, totalSeats, t]);

  const canSubmit = fullName.trim().length > 0 && tableIds.length > 0 && zoneId.length > 0 && !pending;

  function resetForm() {
    setFullName('');
    setPhone('');
    setPartySize(2);
    setZoneId(zones[0]?.id ?? '');
    setTableIds([]);
    setNote('');
    setCustomDuration(false);
    setDuration(90);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    const trimmedName = fullName.trim();
    const result = await create({
      full_name: trimmedName,
      phone: phone.trim() || undefined,
      party_size: partySize,
      zone_id: zoneId,
      table_ids: tableIds,
      guest_note: note.trim() || undefined,
      duration_minutes: customDuration ? duration : undefined,
    });

    if (result.ok) {
      setSuccessName(trimmedName);
      setSuccess(result);
      resetForm();
      onClose();
    } else {
      setError(ERROR_KEYS.has(result.code) ? result.code : 'unknown');
    }
  }

  return (
    <>
      {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
        <div className="absolute inset-0 bg-black/40" onClick={pending ? undefined : handleClose} aria-hidden="true" />
        <form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-label={t('dialog.title')}
          className="relative bg-cream md:bg-white md:rounded-card w-full h-full md:h-auto md:max-w-[560px] md:max-h-[85vh] flex flex-col shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/60 md:rounded-t-card">
            <h2
              className="text-[18px] text-[#1e1508]"
              style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
            >
              {t('dialog.title')}
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="tafel-tap p-2 -m-1 rounded text-[#1e1508] hover:bg-[#f0e8d8] transition-colors"
              aria-label="Sluiten"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            <Field label={t('field.name.label')}>
              <input
                type="text"
                autoFocus
                data-testid="walkin-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                placeholder={t('field.name.placeholder')}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              />
            </Field>

            <Field label={t('field.phone.label')}>
              <input
                type="text"
                inputMode="tel"
                data-testid="walkin-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('field.phone.placeholder')}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              />
            </Field>

            <Field label={t('field.party.label')}>
              <input
                type="number"
                data-testid="walkin-party"
                min={MIN_PARTY_SIZE}
                max={MAX_PARTY_SIZE}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              />
            </Field>

            <Field label={t('field.zone.label')}>
              <select
                data-testid="walkin-zone"
                value={zoneId}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  setTableIds([]);
                }}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              >
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('field.tables.label')}>
              <div className="flex flex-col gap-1.5">
                {(selectedZone?.tables ?? []).map((table) => (
                  <label
                    key={table.id}
                    className="tafel-tap flex items-center gap-2 text-[14px] text-[#1e1508] px-3 py-2 rounded-lg border border-[#e7ddc9] bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      data-testid={`walkin-table-${table.id}`}
                      checked={tableIds.includes(table.id)}
                      onChange={() => toggleTable(table.id)}
                      disabled={pending}
                    />
                    {table.label} · {table.seats} {locale === 'nl' ? 'stoelen' : 'seats'}
                  </label>
                ))}
              </div>
              <p className="text-[12px] text-[#8c8577] mt-1.5">{t('field.tables.hint', { n: partySize })}</p>
              {seatsHint && (
                <p className={`text-[12px] mt-1 ${seatsHint.tooMuch ? 'text-[#b3422f]' : 'text-[#4a7c59]'}`}>
                  {seatsHint.text}
                </p>
              )}
            </Field>

            <Field label={t('field.note.label')}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                disabled={pending}
                rows={3}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white resize-none"
              />
              <div className="text-right text-[11px] text-[#8c8577] mt-1">
                {note.length}/{MAX_NOTE_LENGTH}
              </div>
            </Field>

            <div>
              <button
                type="button"
                onClick={() => setCustomDuration((v) => !v)}
                className="tafel-tap text-[12px] uppercase tracking-[0.08em] text-[#8c8577]"
                style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
              >
                {t('field.duration.toggle')}
              </button>
              {customDuration && (
                <div className="mt-2">
                  <Field label={t('field.duration.label')}>
                    <input
                      type="number"
                      min={MIN_DURATION_MINUTES}
                      max={MAX_DURATION_MINUTES}
                      step={15}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      disabled={pending}
                      className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
                    />
                  </Field>
                </div>
              )}
            </div>

            {error && (
              <p className="text-[13px] text-[#b3422f]" data-testid="walkin-error">
                {t(`error.${error}`)}
              </p>
            )}
          </div>

          <div className="px-4 py-3 bg-white/60 flex justify-end gap-2 md:rounded-b-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              data-testid="walkin-submit"
              disabled={!canSubmit}
              className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {pending ? '…' : t('submit')}
            </button>
          </div>
        </form>
      </div>
      )}

      {success && (
        <SuccessToast
          result={success}
          name={successName}
          t={t}
          onViewBooking={() => {
            onViewBooking(success.bookingId);
            setSuccess(null);
          }}
          onDismiss={() => setSuccess(null)}
        />
      )}
    </>
  );
}

function SuccessToast({
  result,
  name,
  t,
  onViewBooking,
  onDismiss,
}: {
  result: WalkInResult & { ok: true };
  name: string;
  t: ReturnType<typeof useTranslations>;
  onViewBooking: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5 flex items-center gap-3"
      data-testid="walkin-success-toast"
    >
      <span className="text-[13px] text-[#1e1508]">
        {result.matchedExistingGuest
          ? t('success.matched', { name, count: result.visitCountBefore })
          : t('success.plain')}
      </span>
      <button
        type="button"
        onClick={onViewBooking}
        className="tafel-tap text-[12px] uppercase tracking-[0.08em] text-[#1e1508] underline"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('success.viewBooking')}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="block text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
