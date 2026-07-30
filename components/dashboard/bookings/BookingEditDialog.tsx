'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { amsterdamCivilDate, amsterdamWallClockToUtc } from '@/lib/dashboard/date/amsterdamDay';
import type { BookableZoneOption, BookingEditPatch } from '@/lib/dashboard/bookings/types';
import type { BookingActionResult } from '@/lib/dashboard/actions/bookingActions';

type BookingEditDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (patch: BookingEditPatch) => Promise<BookingActionResult>;
  pending: boolean;
  locale: 'nl' | 'en';
  zones: BookableZoneOption[];
  booking: {
    slot_time: string;
    party_size: number;
    zone_id: string | null;
    table_ids: string[];
    guest_note: string | null;
  };
};

const MAX_NOTE_LENGTH = 500;
const MIN_PARTY_SIZE = 1;
const MAX_PARTY_SIZE = 30;

function amsterdamTimeOfDay(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

const ERROR_KEYS = new Set([
  'outside_availability',
  'half_full_violated',
  'table_conflict',
  'no_changes',
  'invalid_body',
  'not_found',
  'terminal_state',
  'rate_limited',
  'not_authenticated',
]);

export default function BookingEditDialog({
  open,
  onClose,
  onSubmit,
  pending,
  locale,
  zones,
  booking,
}: BookingEditDialogProps) {
  const t = useTranslations('dashboard.bookings.action.dialog.edit');
  const tError = useTranslations('dashboard.bookings.action.error');

  const initialDate = amsterdamCivilDate(new Date(booking.slot_time));
  const initialTime = amsterdamTimeOfDay(booking.slot_time);

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [partySize, setPartySize] = useState(booking.party_size);
  const [zoneId, setZoneId] = useState(booking.zone_id ?? zones[0]?.id ?? '');
  const [tableIds, setTableIds] = useState<string[]>(booking.table_ids);
  const [note, setNote] = useState(booking.guest_note ?? '');
  const [error, setError] = useState<string | null>(null);

  const selectedZone = zones.find((z) => z.id === zoneId) ?? null;

  function toggleTable(tableId: string) {
    setTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
  }

  const patch = useMemo<BookingEditPatch>(() => {
    const result: BookingEditPatch = {};
    const newSlotIso = amsterdamWallClockToUtc(date, `${time}:00`).toISOString();
    if (newSlotIso !== booking.slot_time) result.slot_time = newSlotIso;
    if (partySize !== booking.party_size) result.party_size = partySize;
    if (zoneId !== (booking.zone_id ?? '')) result.zone_id = zoneId;
    const sortedNew = [...tableIds].sort();
    const sortedCurrent = [...booking.table_ids].sort();
    if (sortedNew.length !== sortedCurrent.length || sortedNew.some((id, i) => id !== sortedCurrent[i])) {
      result.table_ids = tableIds;
    }
    const trimmedNote = note.trim();
    const currentNote = booking.guest_note ?? '';
    if (trimmedNote !== currentNote) result.guest_note = trimmedNote.length > 0 ? trimmedNote : null;
    return result;
  }, [date, time, partySize, zoneId, tableIds, note, booking]);

  const hasChanges = Object.keys(patch).length > 0;

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasChanges || pending) return;
    setError(null);
    const result = await onSubmit(patch);
    if (result.ok) {
      onClose();
    } else {
      setError(ERROR_KEYS.has(result.code) ? result.code : 'unknown');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={pending ? undefined : onClose} aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
        className="relative bg-cream md:bg-white md:rounded-card w-full h-full md:h-auto md:max-w-[560px] md:max-h-[85vh] flex flex-col shadow-[0_12px_40px_rgba(30,21,8,0.18)]"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/60 md:rounded-t-card">
          <h2
            className="text-[18px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
          >
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('field.date')}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              />
            </Field>
            <Field label={t('field.time')}>
              <input
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={pending}
                className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
              />
            </Field>
          </div>

          <Field label={t('field.party')}>
            <input
              type="number"
              min={MIN_PARTY_SIZE}
              max={MAX_PARTY_SIZE}
              value={partySize}
              onChange={(e) => setPartySize(Number(e.target.value))}
              disabled={pending}
              className="w-full rounded-lg border border-[#e7ddc9] px-3 py-2 text-[14px] text-[#1e1508] bg-white"
            />
          </Field>

          <Field label={t('field.zone')}>
            <select
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

          <Field label={t('field.tables')}>
            <div className="flex flex-col gap-1.5">
              {(selectedZone?.tables ?? []).map((table) => (
                <label
                  key={table.id}
                  className="tafel-tap flex items-center gap-2 text-[14px] text-[#1e1508] px-3 py-2 rounded-lg border border-[#e7ddc9] bg-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={tableIds.includes(table.id)}
                    onChange={() => toggleTable(table.id)}
                    disabled={pending}
                  />
                  {table.label} · {table.seats} {locale === 'nl' ? 'stoelen' : 'seats'}
                </label>
              ))}
            </div>
          </Field>

          <Field label={t('field.note')}>
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

          {error && (
            <p className="text-[13px] text-[#b3422f]">
              {tError(ERROR_KEYS.has(error) ? error : 'unknown')}
            </p>
          )}
        </div>

        <div className="px-4 py-3 bg-white/60 flex justify-end gap-2 md:rounded-b-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || !hasChanges}
            className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {pending ? '…' : t('submit')}
          </button>
        </div>
      </form>
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
