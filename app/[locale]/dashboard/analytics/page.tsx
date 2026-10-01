import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { resolveDashboardContext } from '@/lib/dashboard/resolveDashboardContext'
import { can, homePathFor } from '@/lib/dashboard/permissions'
import { getRestaurantTier, tierAtLeast } from '@/lib/dashboard/tier'
import { amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay'
import { loadInsightData, parseRange } from '@/lib/dashboard/insights/queries'
import {
  LEAD_BUCKETS,
  PARTY_BUCKETS,
  computeOccupancy,
  computeOrders,
  computePatterns,
  computeTopDishes,
} from '@/lib/dashboard/insights/compute'
import SectionHeader from '@/components/dashboard/ui/SectionHeader'
import InsightsTeaser from '@/components/dashboard/insights/InsightsTeaser'
import RangePicker from '@/components/dashboard/insights/RangePicker'
import { BarSeries, RankedBars } from '@/components/dashboard/insights/Charts'

export const dynamic = 'force-dynamic'

type SearchParams = { range?: string; from?: string; to?: string }

const heading = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const body = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const
const muted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

function Card({ title, testId, children, note }: { title: string; testId: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mt-4 bg-white rounded-card p-5" data-testid={testId}>
      <h2 className="text-[16px] text-[#1e1508]" style={heading}>{title}</h2>
      {note && <p className="mt-0.5 text-[12px] text-[#8c8577]" style={muted}>{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-card bg-[#f7f2e9] px-4 py-3">
      <div className="text-[12px] text-[#8c8577]" style={muted}>{label}</div>
      <div className="mt-0.5 text-[20px] text-[#1e1508]" style={heading} data-testid={testId}>{value}</div>
    </div>
  )
}

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale: rawLocale } = await params
  const sp = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  // View gate (owner + manager) also runs inside resolveDashboardContext.
  const context = await resolveDashboardContext(locale)
  const role = context.staff.role
  if (!can(role, 'insights.read')) redirect(`${locale === 'en' ? '/en' : ''}${homePathFor(role)}`)

  const restaurantId = context.restaurant.id
  const tier = await getRestaurantTier(restaurantId)
  const t = await getTranslations({ locale, namespace: 'dashboard.insights' })
  const header = <SectionHeader title={t('title')} subtitle={t('subtitle')} />

  // Starter: preview only — no restaurant data is queried at all.
  if (!tierAtLeast(tier, 'plus')) {
    return (
      <div className="max-w-[880px] pb-12">
        {header}
        <InsightsTeaser locale={locale} isOwner={role === 'owner'} />
      </div>
    )
  }

  const range = parseRange(sp)
  const data = await loadInsightData(restaurantId, range)
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL')
  const money = (cents: number) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString(locale === 'en' ? 'en-GB' : 'nl-NL', { maximumFractionDigits: 1 })}%`)
  const dayFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { timeZone: 'UTC', day: 'numeric', month: 'short' })
  const fullFmt = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long' })
  const weekdayName = (w: number) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(2026, 0, 4 + w)))
  const asDate = (d: string) => new Date(`${d}T12:00:00Z`)

  const occ = computeOccupancy(data.bookings, range.from, range.to)
  const patterns = computePatterns(data.bookings, data.previousBookings)
  const orders = computeOrders(data.orders)
  const dishes = computeTopDishes(data.orders)
  const empty = t('empty')

  const noData = occ.totalBookings === 0 && orders.total === 0 && patterns.current.total === 0

  const labelStep = Math.max(1, Math.ceil(occ.days.length / 10))
  const rates = patterns.current
  const prev = patterns.previous

  const delta = (cur: number | null, old: number | null) => {
    if (cur === null || old === null) return null
    const d = (cur - old) * 100
    return `${d > 0 ? '+' : ''}${d.toLocaleString(locale === 'en' ? 'en-GB' : 'nl-NL', { maximumFractionDigits: 1 })} ${t('patterns.points')}`
  }

  return (
    <div className="max-w-[880px] pb-12">
      {header}
      <div className="mt-3">
        <RangePicker preset={range.preset} from={range.from} to={range.to} maxDate={amsterdamCivilDate(new Date())} />
      </div>
      <p className="mt-2 text-[12px] text-[#8c8577]" style={muted} data-testid="insights-range-label">
        {dayFmt.format(asDate(range.from))} – {dayFmt.format(asDate(range.to))} · {t('range.daysCount', { n: range.days })}
      </p>

      {noData && (
        <p className="mt-6 rounded-card bg-[#f7f2e9] px-5 py-6 text-[14px] text-[#6f6353]" style={body} data-testid="insights-empty">{empty}</p>
      )}

      {/* 1. Occupancy */}
      <Card title={t('occupancy.title')} testId="insights-occupancy" note={t('occupancy.note')}>
        {occ.totalBookings === 0 ? (
          <p className="text-[14px] text-[#6f6353]" style={body}>{empty}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Stat label={t('occupancy.bookings')} value={nf.format(occ.totalBookings)} testId="occ-bookings" />
              <Stat label={t('occupancy.covers')} value={nf.format(occ.totalCovers)} testId="occ-covers" />
            </div>
            <BarSeries
              testId="chart-occupancy"
              names={[t('occupancy.covers'), t('occupancy.bookings')]}
              twoSeries
              xInterval={labelStep - 1}
              data={occ.days.map((d) => ({ label: dayFmt.format(asDate(d.date)), tooltipLabel: fullFmt.format(asDate(d.date)), value: d.covers, value2: d.bookings }))}
            />
            <p className="mt-2 text-[11px] text-[#8c8577]" style={muted}>{t('occupancy.legend')}</p>
            {occ.busiestWeekday !== null && (
              <p className="mt-3 text-[15px] text-[#1e1508]" style={heading} data-testid="occ-weekday">
                {t('occupancy.busiest', { weekday: weekdayName(occ.busiestWeekday).replace(/^./, (c) => c.toUpperCase()) })}
              </p>
            )}
          </>
        )}
      </Card>

      {/* 2. Booking patterns */}
      <Card title={t('patterns.title')} testId="insights-patterns">
        {patterns.current.total === 0 ? (
          <p className="text-[14px] text-[#6f6353]" style={body}>{empty}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-2" style={heading}>{t('patterns.lead')}</h3>
              <RankedBars testId="chart-lead" rows={LEAD_BUCKETS.map((k) => ({ label: t(`patterns.leadBuckets.${k}`), value: patterns.lead[k] }))} />
            </div>
            <div>
              <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-2" style={heading}>{t('patterns.party')}</h3>
              <RankedBars testId="chart-party" rows={PARTY_BUCKETS.map((k) => ({ label: t(`patterns.partyBuckets.${k}`), value: patterns.party[k] }))} />
            </div>
            <div className="grid grid-cols-2 gap-2" data-testid="patterns-rates">
              <div className="rounded-card bg-[#f7f2e9] px-4 py-3">
                <div className="text-[12px] text-[#8c8577]" style={muted}>{t('patterns.cancellationRate')}</div>
                <div className="mt-0.5 text-[20px] text-[#1e1508]" style={heading} data-testid="rate-cancel">{pct(rates.cancellationRate)}</div>
                <div className="text-[11px] text-[#8c8577]" style={muted}>{t('patterns.cancelledOf', { n: rates.cancelled, total: rates.total })}</div>
                {prev && delta(rates.cancellationRate, prev.cancellationRate) && (
                  <div className="mt-1 text-[11px] text-[#6f6353]" style={body} data-testid="rate-cancel-delta">
                    {t('patterns.vsPrevious', { value: delta(rates.cancellationRate, prev.cancellationRate) as string })}
                  </div>
                )}
              </div>
              <div className="rounded-card bg-[#f7f2e9] px-4 py-3">
                <div className="text-[12px] text-[#8c8577]" style={muted}>{t('patterns.noShowRate')}</div>
                <div className="mt-0.5 text-[20px] text-[#1e1508]" style={heading} data-testid="rate-noshow">{pct(rates.noShowRate)}</div>
                <div className="text-[11px] text-[#8c8577]" style={muted}>{t('patterns.noShowsCount', { n: rates.noShows })}</div>
                {prev && delta(rates.noShowRate, prev.noShowRate) && (
                  <div className="mt-1 text-[11px] text-[#6f6353]" style={body} data-testid="rate-noshow-delta">
                    {t('patterns.vsPrevious', { value: delta(rates.noShowRate, prev.noShowRate) as string })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 3. Orders */}
      <Card title={t('orders.title')} testId="insights-orders">
        {orders.total === 0 ? (
          <p className="text-[14px] text-[#6f6353]" style={body}>{empty}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label={t('orders.qr')} value={nf.format(orders.qr)} testId="orders-qr" />
              <Stat label={t('orders.takeaway')} value={nf.format(orders.takeaway)} testId="orders-takeaway" />
              <Stat label={t('orders.aov')} value={orders.averageOrderValueCents === null ? '—' : money(orders.averageOrderValueCents)} testId="orders-aov" />
            </div>
            <p className="text-[11px] text-[#8c8577] mb-3" style={muted}>{t('orders.aovNote', { n: orders.paidOrders })}</p>
            <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-2" style={heading}>{t('orders.hours')}</h3>
            <BarSeries
              testId="chart-hours"
              height={180}
              names={[t('orders.ordersLabel')]}
              xInterval={2}
              data={orders.hours.map((v, h) => ({ label: `${h}`, tooltipLabel: `${String(h).padStart(2, '0')}:00`, value: v }))}
            />
            {orders.busiestHour !== null && (
              <p className="mt-2 text-[13px] text-[#1e1508]" style={body} data-testid="orders-busiest">
                {t('orders.busiest', { hour: `${String(orders.busiestHour).padStart(2, '0')}:00` })}
              </p>
            )}
          </>
        )}
      </Card>

      {/* 4. Top dishes */}
      <Card title={t('dishes.title')} testId="insights-dishes">
        {dishes.distinct === 0 ? (
          <p className="text-[14px] text-[#6f6353]" style={body}>{empty}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-2" style={heading}>{t('dishes.top')}</h3>
              <RankedBars testId="dishes-top" rows={dishes.top.map((d) => ({ label: d.name, value: d.quantity, display: `${d.quantity}×` }))} />
            </div>
            {dishes.bottom.length > 0 && (
              <div data-testid="dishes-bottom">
                <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-1" style={heading}>{t('dishes.bottom')}</h3>
                <p className="text-[12px] text-[#6f6353] mb-2" style={body}>{t('dishes.bottomHint')}</p>
                <RankedBars rows={dishes.bottom.map((d) => ({ label: d.name, value: d.quantity, display: `${d.quantity}×` }))} />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
