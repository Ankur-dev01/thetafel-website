'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import DetailPanel from '@/components/dashboard/ui/DetailPanel';
import DetailSheet from '@/components/dashboard/ui/DetailSheet';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import type { GuestDetail, GuestListPage } from '@/lib/dashboard/guests/guests';
import GuestDetailBody, { VipStar, formatDate } from './GuestDetailBody';
import GuestExportButton from './GuestExportButton';

type Props = {
  locale: 'nl' | 'en';
  initialQuery: string;
  initialList: GuestListPage;
  initialGuest: GuestDetail | null;
  canEditNote: boolean;
  canToggleVip: boolean;
  showVip: boolean;
  canExport: boolean;
};

const label = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const body = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const muted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const;

export default function GuestsView({
  locale,
  initialQuery,
  initialList,
  initialGuest,
  canEditNote,
  canToggleVip,
  showVip,
  canExport,
}: Props) {
  const t = useTranslations('dashboard.guests');
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [list, setList] = useState(initialList);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GuestDetail | null>(initialGuest);
  const [selectedId, setSelectedId] = useState<string | null>(initialGuest?.id ?? null);
  const [detailError, setDetailError] = useState(false);
  const firstRun = useRef(true);

  const syncUrl = useCallback(
    (q: string, guestId: string | null) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (guestId) params.set('guest', guestId);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const load = useCallback(async (q: string, page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/guests?q=${encodeURIComponent(q)}&page=${page}`, { cache: 'no-store' });
      if (res.ok) setList((await res.json()) as GuestListPage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced server-side search.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void load(query.trim(), 1);
      syncUrl(query.trim(), selectedId);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function openGuest(id: string) {
    setSelectedId(id);
    setDetailError(false);
    syncUrl(query.trim(), id);
    const res = await fetch(`/api/dashboard/guests/${id}`, { cache: 'no-store' });
    if (res.ok) {
      setSelected(((await res.json()) as { guest: GuestDetail }).guest);
    } else {
      setSelected(null);
      setDetailError(true);
    }
  }

  function closeGuest() {
    setSelected(null);
    setSelectedId(null);
    setDetailError(false);
    syncUrl(query.trim(), null);
  }

  function onChanged(patch: Partial<GuestDetail>) {
    setSelected((g) => (g ? { ...g, ...patch } : g));
    if (patch.vip !== undefined) {
      setList((l) => ({ ...l, rows: l.rows.map((r) => (r.id === selectedId ? { ...r, vip: patch.vip as boolean } : r)) }));
    }
  }

  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const detail = selected ? (
    <GuestDetailBody
      key={selected.id}
      guest={selected}
      locale={locale}
      canEditNote={canEditNote}
      canToggleVip={canToggleVip}
      showVip={showVip}
      onChanged={onChanged}
    />
  ) : detailError ? (
    <p className="text-[14px] text-[#6f6353]" style={body}>{t('detail.notFound')}</p>
  ) : (
    <p className="text-[14px] text-[#6f6353]" style={muted}>{t('detail.loading')}</p>
  );

  return (
    <div>
      <div className="sticky top-[52px] z-10 -mx-4 md:mx-0 px-4 md:px-0 pt-2 pb-3 bg-cream/95 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">{t('searchLabel')}</span>
            <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8c8577" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              data-testid="guests-search"
              className="w-full rounded-full border border-[#e7ddc9] bg-white pl-11 pr-4 py-3.5 text-[16px] text-[#1e1508] outline-none focus:border-amber"
              style={body}
            />
          </label>
          {canExport && <GuestExportButton />}
        </div>
      </div>

      {list.rows.length === 0 ? (
        <div className="mt-4" data-testid="guests-empty">
          <EmptyState heading={query ? t('emptySearch') : t('emptyTitle')} body={query ? undefined : t('emptyBody')} />
        </div>
      ) : (
        <>
          <div className="mt-2 hidden md:grid grid-cols-[1fr_90px_140px_36px] gap-3 px-4 text-[11px] uppercase tracking-[0.08em] text-[#8c8577]" style={label}>
            <span>{t('columns.name')}</span>
            <span className="text-right">{t('columns.visits')}</span>
            <span>{t('columns.lastVisit')}</span>
            <span />
          </div>
          <ul className={`mt-2 flex flex-col gap-2 ${loading ? 'opacity-60' : ''}`} data-testid="guests-list">
            {list.rows.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => openGuest(g.id)}
                  data-testid="guest-row"
                  aria-current={g.id === selectedId ? 'true' : undefined}
                  className={`tafel-tap w-full text-left bg-white rounded-card px-4 py-3 md:grid md:grid-cols-[1fr_90px_140px_36px] md:items-center md:gap-3 ${g.id === selectedId ? 'ring-2 ring-amber' : ''}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${g.marketingConsent ? 'bg-[#5fb46f]' : 'bg-[#e0d6c3]'}`}
                      title={g.marketingConsent ? t('consentDotYes') : t('consentDotNo')}
                      aria-label={g.marketingConsent ? t('consentDotYes') : t('consentDotNo')}
                    />
                    <span className="truncate text-[15px] text-[#1e1508]" style={label}>{g.name || '—'}</span>
                  </span>
                  <span className="mt-1 flex gap-3 text-[12px] text-[#6f6353] md:contents" style={muted}>
                    <span className="md:text-right md:text-[14px] md:text-[#1e1508]">
                      <span className="md:hidden">{t('columns.visits')}: </span>
                      {g.visits}
                    </span>
                    <span className="md:text-[14px] md:text-[#1e1508]">
                      <span className="md:hidden">{t('columns.lastVisit')}: </span>
                      {formatDate(g.lastVisit, locale)}
                    </span>
                  </span>
                  <span className="hidden md:flex justify-center">{showVip && g.vip && <VipStar filled />}</span>
                  {showVip && g.vip && <span className="md:hidden sr-only">VIP</span>}
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label={t('pagination')}>
              <button type="button" disabled={list.page <= 1 || loading} onClick={() => load(query.trim(), list.page - 1)} className="text-amber underline underline-offset-2 disabled:opacity-40" style={label}>
                &larr; {t('prev')}
              </button>
              <span className="text-[#6f6353]" style={muted}>{list.page} / {pages} · {t('total', { count: list.total })}</span>
              <button type="button" disabled={list.page >= pages || loading} onClick={() => load(query.trim(), list.page + 1)} className="text-amber underline underline-offset-2 disabled:opacity-40" style={label}>
                {t('next')} &rarr;
              </button>
            </nav>
          )}
        </>
      )}

      {selectedId && (
        <>
          <div className="hidden md:block">
            <DetailPanel title={selected?.name ?? t('detail.title')} onClose={closeGuest}>
              {detail}
            </DetailPanel>
          </div>
          <div className="md:hidden">
            <DetailSheet open title={selected?.name ?? t('detail.title')} onClose={closeGuest}>
              {detail}
            </DetailSheet>
          </div>
        </>
      )}
    </div>
  );
}
