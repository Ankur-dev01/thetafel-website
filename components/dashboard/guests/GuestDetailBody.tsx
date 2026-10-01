'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { GuestDetail } from '@/lib/dashboard/guests/guests';

const label = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const body = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const muted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const;

const NOTE_MAX = 2000;

export function formatMoney(cents: number, locale: 'nl' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDate(iso: string | null, locale: 'nl' | 'en', withTime = false): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));
}

export function VipStar({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill={filled ? '#d4820a' : 'none'}
        stroke={filled ? '#d4820a' : '#c2b594'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  guest: GuestDetail;
  locale: 'nl' | 'en';
  canEditNote: boolean;
  canToggleVip: boolean;
  showVip: boolean;
  onChanged: (patch: Partial<GuestDetail>) => void;
};

export default function GuestDetailBody({ guest, locale, canEditNote, canToggleVip, showVip, onChanged }: Props) {
  const t = useTranslations('dashboard.guests');
  const [note, setNote] = useState(guest.note ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [vipBusy, setVipBusy] = useState(false);

  const dirty = note.trim() !== (guest.note ?? '');

  async function saveNote() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/dashboard/guests/${guest.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const j = (await res.json()) as { ok?: boolean; note?: string | null; updatedAt?: string };
      if (res.ok && j.ok) {
        onChanged({ note: j.note ?? null, noteUpdatedAt: j.updatedAt ?? null });
        setStatus({ ok: true, text: t('detail.noteSaved') });
      } else {
        setStatus({ ok: false, text: t('detail.noteError') });
      }
    } catch {
      setStatus({ ok: false, text: t('detail.noteError') });
    }
    setSaving(false);
  }

  async function toggleVip() {
    setVipBusy(true);
    try {
      const res = await fetch(`/api/dashboard/guests/${guest.id}/vip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vip: !guest.vip }),
      });
      if (res.ok) onChanged({ vip: !guest.vip });
    } finally {
      setVipBusy(false);
    }
  }

  const statusLabel = (kind: 'booking' | 'order', s: string) => t(`status.${kind}.${s}` as never);

  return (
    <div className="flex flex-col gap-5" data-testid="guest-detail">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] text-[#1e1508] break-words" style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}>
            {guest.name}
          </h2>
          <p className="mt-0.5 text-[12px] text-[#8c8577]" style={muted}>
            {t('detail.customerSince', { date: formatDate(guest.customerSince, locale) })}
          </p>
        </div>
        {showVip &&
          (canToggleVip ? (
            <button
              type="button"
              onClick={toggleVip}
              disabled={vipBusy}
              aria-pressed={guest.vip}
              data-testid="guest-vip-toggle"
              className="tafel-tap flex items-center gap-1.5 rounded-full border border-[#e7ddc9] px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-[#1e1508] disabled:opacity-50"
              style={label}
            >
              <VipStar filled={guest.vip} size={14} />
              {guest.vip ? t('detail.vipOn') : t('detail.vipOff')}
            </button>
          ) : guest.vip ? (
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-[#a86205]" style={label}>
              <VipStar filled size={14} /> VIP
            </span>
          ) : null)}
      </div>

      <section>
        <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#8c8577]" style={label}>{t('detail.contact')}</h3>
        <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
          <dt className="text-[#6f6353]" style={muted}>{t('detail.email')}</dt>
          <dd className="text-[#1e1508] break-all" style={body}>
            {guest.email ? <a className="underline underline-offset-2" href={`mailto:${guest.email}`}>{guest.email}</a> : '—'}
          </dd>
          <dt className="text-[#6f6353]" style={muted}>{t('detail.phone')}</dt>
          <dd className="text-[#1e1508]" style={body}>
            {guest.phone ? <a className="underline underline-offset-2" href={`tel:${guest.phone}`}>{guest.phone}</a> : '—'}
          </dd>
          <dt className="text-[#6f6353]" style={muted}>{t('detail.consent')}</dt>
          <dd className="text-[#1e1508]" style={body} data-testid="guest-consent">
            {guest.marketingConsent
              ? t('detail.consentYes', { date: formatDate(guest.marketingConsentAt, locale) })
              : t('detail.consentNo')}
            <span className="block text-[11px] text-[#8c8577]" style={muted}>{t('detail.consentHint')}</span>
          </dd>
        </dl>
      </section>

      <section className="grid grid-cols-3 gap-2">
        {[
          [t('detail.visits'), String(guest.visits)],
          [t('detail.lastVisit'), formatDate(guest.lastVisit, locale)],
          [t('detail.spend'), formatMoney(guest.spend.totalCents, locale)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card bg-[#f7f2e9] px-3 py-2.5">
            <div className="text-[11px] text-[#8c8577]" style={muted}>{k}</div>
            <div className="mt-0.5 text-[15px] text-[#1e1508]" style={label} data-testid={k === t('detail.spend') ? 'guest-spend' : undefined}>{v}</div>
          </div>
        ))}
        <p className="col-span-3 text-[11px] text-[#8c8577] leading-snug" style={muted}>
          {t('detail.spendExplainer', {
            orders: formatMoney(guest.spend.ordersCents, locale),
            deposits: formatMoney(guest.spend.depositsCents, locale),
          })}
        </p>
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#8c8577]" style={label}>{t('detail.notes')}</h3>
        {canEditNote ? (
          <>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setStatus(null);
              }}
              maxLength={NOTE_MAX}
              rows={4}
              placeholder={t('detail.notePlaceholder')}
              data-testid="guest-note"
              className="mt-2 w-full rounded-[10px] border border-[#e7ddc9] bg-[#fdfaf5] px-3 py-2 text-[14px] text-[#1e1508] outline-none focus:border-amber"
              style={body}
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#8c8577]" style={muted}>{note.length}/{NOTE_MAX}</span>
              <button
                type="button"
                onClick={saveNote}
                disabled={!dirty || saving}
                data-testid="guest-note-save"
                className="tafel-tap px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
                style={label}
              >
                {saving ? t('detail.saving') : t('detail.saveNote')}
              </button>
            </div>
            {status && (
              <p role={status.ok ? 'status' : 'alert'} className={`mt-1 text-[12px] ${status.ok ? 'text-[#2f6b3d]' : 'text-[#b3422f]'}`} style={body} data-testid="guest-note-status">
                {status.text}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-[14px] text-[#1e1508] whitespace-pre-wrap" style={body} data-testid="guest-note-readonly">
            {guest.note || '—'}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[#8c8577] leading-snug" style={muted} data-testid="guest-note-hint">
          {t('detail.noteHint')}
        </p>
      </section>

      <section>
        <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#8c8577]" style={label}>{t('detail.history')}</h3>
        <ul className="mt-2 divide-y divide-[#f0e8d6]" data-testid="guest-history">
          {guest.history.map((h) => (
            <li key={`${h.kind}-${h.id}`} className="py-2 flex items-center justify-between gap-3 text-[13px]">
              <div className="min-w-0">
                <div className="text-[#1e1508]" style={body}>
                  {h.kind === 'booking'
                    ? t('detail.historyBooking', { count: h.partySize })
                    : h.orderType === 'qr'
                      ? t('detail.historyQr')
                      : t('detail.historyTakeaway')}
                  <span className="ml-2 text-[11px] text-[#8c8577]" style={muted}>{h.ref}</span>
                </div>
                <div className="text-[12px] text-[#8c8577]" style={muted}>{formatDate(h.date, locale, true)}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[12px] text-[#6f6353]" style={label}>{statusLabel(h.kind, h.status)}</div>
                {h.kind === 'order' && (
                  <div className="text-[12px] text-[#1e1508]" style={body}>{formatMoney(h.totalCents, locale)}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
