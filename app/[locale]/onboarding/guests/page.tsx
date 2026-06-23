'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'

// ── Default templates ─────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE_NL = `Beste {naam},

Bedankt voor je reservering bij {restaurant}. We kijken ernaar uit je te ontvangen op {datum} om {tijd} voor {gasten}.

Adres: {adres}

Tot snel,
{restaurant}`

const DEFAULT_TEMPLATE_EN = `Dear {naam},

Thanks for booking with {restaurant}. We look forward to welcoming you on {datum} at {tijd} for {gasten}.

Address: {adres}

See you soon,
{restaurant}`

// ── Sample preview values ─────────────────────────────────────────────────────

const SAMPLE_VARS_NL: Record<string, string> = {
  '{naam}': 'Maria',
  '{restaurant}': 'Trattoria Roma',
  '{datum}': 'Vrijdag 9 mei',
  '{tijd}': '19:30',
  '{gasten}': '2 gasten',
  '{adres}': 'Ceintuurbaan 28',
}

const SAMPLE_VARS_EN: Record<string, string> = {
  '{naam}': 'Maria',
  '{restaurant}': 'Trattoria Roma',
  '{datum}': 'Friday 9 May',
  '{tijd}': '19:30',
  '{gasten}': '2 guests',
  '{adres}': 'Ceintuurbaan 28',
}

const TEMPLATE_TOKENS = ['{naam}', '{restaurant}', '{datum}', '{tijd}', '{gasten}', '{adres}']

// ── Chip data ─────────────────────────────────────────────────────────────────

const ALLERGY_CHIPS_EN = ['Vegetarian', 'Vegan', 'Gluten-free', 'Nut allergy', 'Lactose-free']
const ALLERGY_CHIPS_NL = ['Vegetariër', 'Veganist', 'Glutenvrij', 'Notenallergie', 'Lactosevrij']
const OCCASION_CHIPS_EN = ['Birthday', 'Anniversary', 'Date night', 'Business dinner', 'Celebration']
const OCCASION_CHIPS_NL = ['Verjaardag', 'Jubileum', 'Date night', 'Zakelijk diner', 'Feest']

// ── Token icon paths ──────────────────────────────────────────────────────────

const TOKEN_ICONS: Record<string, string> = {
  '{naam}': 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
  '{restaurant}': 'M4 9l1.5-4h13L20 9M5 9v10h14V9M4 9h16M9 19v-5h6v5',
  '{datum}': 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
  '{tijd}': 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v4l3 2',
  '{gasten}': 'M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16.5 6a3 3 0 010 6M22 20a6 6 0 00-4-5.6',
  '{adres}': 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

function buildHighlightedPreview(template: string, vars: Record<string, string>): React.ReactNode {
  const tokens = Object.keys(vars)
  const pattern = new RegExp(
    tokens.map((t) => t.replace(/[{}]/g, '\\$&')).join('|'),
    'g'
  )
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(template)) !== null) {
    if (m.index > last) nodes.push(template.slice(last, m.index))
    nodes.push(
      <span key={key++} style={{ color: '#8a5208', fontWeight: 700 }}>
        {vars[m[0]] ?? m[0]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < template.length) nodes.push(template.slice(last))
  return <>{nodes}</>
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'TR'
  if (words.length === 1) return (words[0]![0] ?? 'T').toUpperCase()
  return ((words[0]![0] ?? 'T') + (words[1]![0] ?? 'R')).toUpperCase()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuestsPage() {
  const t = useTranslations('onboarding.guests')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(6)

  // Template state
  const [templateNl, setTemplateNl] = useState(DEFAULT_TEMPLATE_NL)
  const [templateEn, setTemplateEn] = useState(DEFAULT_TEMPLATE_EN)
  const [editingLocale, setEditingLocale] = useState<'nl' | 'en'>(locale)

  // Booking questions
  const [questionAllergies, setQuestionAllergies] = useState(true)
  const [questionOccasion, setQuestionOccasion] = useState(true)
  const [questionRequests, setQuestionRequests] = useState(true)

  // UI-only state (not persisted)
  const [previewChannel, setPreviewChannel] = useState<'Email' | 'WhatsApp'>('Email')
  const [restaurantName, setRestaurantName] = useState('Trattoria Roma')

  // Submit / misc
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Hydration ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', { method: 'GET', cache: 'no-store' })
        if (!res.ok) { if (!cancelled) setHydrated(true); return }
        const data = (await res.json()) as Record<string, unknown>
        if (cancelled) return
        const r = (data?.restaurant ?? {}) as Record<string, unknown>

        try {
          const visibleSteps = getVisibleSteps(r as Parameters<typeof getVisibleSteps>[0])
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(6, visibleSteps) ?? 6)
        } catch { /* leave defaults */ }

        const name = String(r.display_name ?? r.trade_name ?? r.legal_name ?? 'Trattoria Roma')
        if (name) setRestaurantName(name)

        const nlVal = typeof r.confirmation_template_nl === 'string' && r.confirmation_template_nl.length > 0
          ? r.confirmation_template_nl : DEFAULT_TEMPLATE_NL
        const enVal = typeof r.confirmation_template_en === 'string' && r.confirmation_template_en.length > 0
          ? r.confirmation_template_en : DEFAULT_TEMPLATE_EN
        setTemplateNl(nlVal)
        setTemplateEn(enVal)

        setQuestionAllergies(parseBool(r.booking_question_allergies, true))
        setQuestionOccasion(parseBool(r.booking_question_occasion, true))
        setQuestionRequests(parseBool(r.booking_question_requests, true))

        if (!cancelled) setHydrated(true)
      } catch { if (!cancelled) setHydrated(true) }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [pathname])

  // ── Build patch ───────────────────────────────────────────────────────────

  function buildGuestsPatch() {
    return {
      confirmation_template_nl: templateNl,
      confirmation_template_en: templateEn,
      booking_question_allergies: questionAllergies,
      booking_question_occasion: questionOccasion,
      booking_question_requests: questionRequests,
    }
  }

  // ── Template handlers ─────────────────────────────────────────────────────

  function handleTemplateChange(value: string) {
    if (editingLocale === 'nl') {
      setTemplateNl(value)
      save({ restaurant: { ...buildGuestsPatch(), confirmation_template_nl: value } })
    } else {
      setTemplateEn(value)
      save({ restaurant: { ...buildGuestsPatch(), confirmation_template_en: value } })
    }
  }

  function insertToken(token: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start
    const current = editingLocale === 'nl' ? templateNl : templateEn
    const next = current.slice(0, start) + token + current.slice(end)
    if (editingLocale === 'nl') setTemplateNl(next)
    else setTemplateEn(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    })
    if (hydrated) {
      save({
        restaurant: {
          ...buildGuestsPatch(),
          [editingLocale === 'nl' ? 'confirmation_template_nl' : 'confirmation_template_en']: next,
        },
      })
    }
  }

  // ── Question handlers ─────────────────────────────────────────────────────

  function handleAllergiesChange(val: boolean) {
    if (!hydrated) return
    setQuestionAllergies(val)
    save({ restaurant: { ...buildGuestsPatch(), booking_question_allergies: val } })
  }

  function handleOccasionChange(val: boolean) {
    if (!hydrated) return
    setQuestionOccasion(val)
    save({ restaurant: { ...buildGuestsPatch(), booking_question_occasion: val } })
  }

  function handleRequestsChange(val: boolean) {
    if (!hydrated) return
    setQuestionRequests(val)
    save({ restaurant: { ...buildGuestsPatch(), booking_question_requests: val } })
  }

  // ── Continue handler ──────────────────────────────────────────────────────

  async function handleContinue() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(6)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 7
      await saveNow({
        restaurant: { ...buildGuestsPatch(), current_onboarding_step: nextStepId },
      })
      const nextPath = stepPath(nextStepId, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeTemplate = editingLocale === 'nl' ? templateNl : templateEn
  const sampleVars = editingLocale === 'nl' ? SAMPLE_VARS_NL : SAMPLE_VARS_EN
  const backHref = previousStepPath(6, visibleStepIds, locale) ?? stepPath(5, locale)
  const questionsOnCount = [questionAllergies, questionOccasion, questionRequests].filter(Boolean).length
  const initials = getInitials(restaurantName)
  const allergyChips = locale === 'nl' ? ALLERGY_CHIPS_NL : ALLERGY_CHIPS_EN
  const occasionChips = locale === 'nl' ? OCCASION_CHIPS_NL : OCCASION_CHIPS_EN

  const stepLabel = locale === 'en'
    ? `Step ${currentDisplayNum} of ${totalSteps} — Reservations`
    : `Stap ${currentDisplayNum} van ${totalSteps} — Reserveringen`

  const previewSubject = locale === 'en'
    ? `Your booking at ${restaurantName} is confirmed`
    : `Je reservering bij ${restaurantName} is bevestigd`

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <StepFrame
      locale={locale}
      showProgress={false}
      hideDefaultHeader
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      heading=""
      backHref={backHref}
      canContinue={true}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @keyframes tfRise {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        .guests-template-grid {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 30px;
          align-items: start;
          margin-bottom: 48px;
        }
        .guests-section-heading {
          font-family: var(--font-raleway), Raleway, sans-serif;
          font-weight: 900;
          font-size: 26px;
          letter-spacing: -0.4px;
          color: var(--earth);
          margin: 0;
          flex-shrink: 0;
        }
        .guests-header-band {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 16px;
        }
        @media (max-width: 768px) {
          .guests-template-grid { grid-template-columns: 1fr !important; }
          .guests-header-band { flex-direction: column !important; align-items: flex-start !important; gap: 22px !important; }
          .guests-header-counter { text-align: left !important; }
          .guests-header-dots { justify-content: flex-start !important; }
          .guests-question-card { padding: 18px 18px !important; }
          .guests-question-icon-tile { width: 40px !important; height: 40px !important; }
          .guests-question-title { font-size: 19px !important; }
        }
      `}</style>

      {/* ── Header band ─────────────────────────────────────────────────────── */}
      <div className="guests-header-band">
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            backgroundColor: 'var(--earth)', color: 'var(--amber)',
            fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
            fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
            padding: '6px 12px', borderRadius: 9999, marginBottom: 14,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: 'var(--amber)', flexShrink: 0, display: 'inline-block' }} />
            {stepLabel}
          </div>
          <h1 style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
            fontSize: 42, lineHeight: 0.96, letterSpacing: '-0.035em',
            color: 'var(--earth)', margin: '0 0 10px 0',
          }}>
            {t('heading')}<span style={{ color: 'var(--amber)' }}>.</span>
          </h1>
          <p style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
            fontSize: 16, lineHeight: 1.5, color: 'var(--stone)', maxWidth: 520, margin: 0,
          }}>
            {t('sub')}
          </p>
        </div>

        {/* Counter + dots */}
        <div className="guests-header-counter" style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
            fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--earth)',
          }}>
            {String(currentDisplayNum).padStart(2, '0')}
            <span style={{ fontSize: 17, color: 'var(--stone-dim)', letterSpacing: '-0.01em' }}>
              /{String(totalSteps).padStart(2, '0')}
            </span>
          </div>
          <div className="guests-header-dots" style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', marginTop: 10 }}>
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1
              return (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: 2,
                  backgroundColor: n === currentDisplayNum ? 'var(--amber)'
                    : n < currentDisplayNum ? 'var(--amber)'
                    : '#e8dfc8',
                }} />
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Section 2: Confirmation message ──────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        {/* Section label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 6px' }}>
          <h2 className="guests-section-heading">{t('templateHeading')}</h2>
          <div style={{ flex: 1, borderTop: '1.5px dotted #d8c49a' }} />
        </div>
        <p style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
          fontSize: 14.5, lineHeight: 1.5, color: '#8a7e6a', margin: '0 0 26px',
        }}>
          {t('templateSub')}
        </p>

        <div className="guests-template-grid">
          {/* ── Editor column ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Language tab row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a8259',
              }}>
                {t('langLabel')}
              </span>
              <div style={{
                display: 'inline-flex', gap: 3, background: '#ede2cc',
                border: '1px solid #e0d3b6', borderRadius: 9999, padding: 4,
              }}>
                {(['nl', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setEditingLocale(loc)}
                    style={{
                      padding: '8px 22px', borderRadius: 9999, border: 'none',
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 800,
                      fontSize: 13, letterSpacing: '0.08em', transition: 'all 0.15s', cursor: 'pointer',
                      background: editingLocale === loc ? 'var(--amber)' : 'transparent',
                      color: editingLocale === loc ? 'white' : '#9a8259',
                      boxShadow: editingLocale === loc ? '0 2px 6px rgba(212,130,10,0.4)' : 'none',
                    }}
                  >
                    {loc === 'nl' ? t('tabNl') : t('tabEn')}
                  </button>
                ))}
              </div>
            </div>

            {/* Variable helper */}
            <p style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
              fontSize: 13, color: '#9a8e7b', margin: '0 0 12px',
            }}>
              {t('varHelper')}
            </p>

            {/* Variable chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 18 }}>
              {TEMPLATE_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => insertToken(token)}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--amber)'
                    el.style.background = '#fbf3e1'
                    el.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget
                    el.style.borderColor = '#e3d7c0'
                    el.style.background = '#f4ecdb'
                    el.style.transform = 'translateY(0)'
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600,
                    fontSize: 13.5, color: '#5a4a35', background: '#f4ecdb',
                    border: '1px solid #e3d7c0', borderRadius: 10,
                    padding: '8px 13px 8px 11px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a5208" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={TOKEN_ICONS[token]} />
                  </svg>
                  {token}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={activeTemplate}
                maxLength={5000}
                onChange={(e) => handleTemplateChange(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--amber)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,130,10,0.14)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e6dabf'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                style={{
                  width: '100%', minHeight: 300, resize: 'vertical',
                  fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
                  fontSize: 15.5, lineHeight: 1.75, color: 'var(--earth)',
                  background: '#fbf6ea', border: '1.5px solid #e6dabf', borderRadius: 16,
                  padding: '22px 22px 40px',
                  boxShadow: 'inset 0 1px 2px rgba(40,30,10,0.04)',
                  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              <span style={{
                position: 'absolute', right: 18, bottom: 16,
                fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600,
                fontSize: 12, color: '#a8997c', pointerEvents: 'none',
              }}>
                {t('charCount', { count: activeTemplate.length })}
              </span>
            </div>
          </div>

          {/* ── Preview column ── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Preview header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a8259',
              }}>
                {t('previewHeading')}
              </span>
              {/* Channel tabs */}
              <div style={{
                display: 'inline-flex', gap: 3, background: '#ede2cc',
                border: '1px solid #e0d3b6', borderRadius: 9999, padding: 4,
              }}>
                {(['Email', 'WhatsApp'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPreviewChannel(ch)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '7px 15px', borderRadius: 9999, border: 'none',
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
                      fontSize: 12.5, transition: 'all 0.15s', cursor: 'pointer',
                      background: previewChannel === ch ? 'var(--earth)' : 'transparent',
                      color: previewChannel === ch ? '#f4ead6' : '#9a8259',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {ch === 'Email'
                        ? <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
                        : <path d="M3 21l1.8-5A8 8 0 1112 20a8 8 0 01-4.2-1.2L3 21z" />}
                    </svg>
                    {ch === 'Email' ? t('tabEmail') : t('tabWhatsApp')}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview card */}
            {previewChannel === 'Email' ? (
              <div key="email" style={{
                background: '#fffdf8', border: '1px solid #ece0c8', borderRadius: 18,
                boxShadow: '0 16px 40px rgba(40,30,10,0.13)', overflow: 'hidden',
                animation: 'tfRise 0.25s ease',
              }}>
                {/* Email header strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 13,
                  padding: '17px 22px', borderBottom: '1px solid #f0e7d5',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 9999, flexShrink: 0,
                    background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
                      fontSize: 16, color: '#3a2a0e',
                    }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
                      fontSize: 15, color: 'var(--earth)', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{restaurantName}</div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
                      fontSize: 12.5, color: '#9a8e7b', marginTop: 1,
                    }}>to {sampleVars['{naam}']}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a8997c', fontSize: 12, flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18v12H3zM3 7l9 6 9-6" />
                    </svg>
                    <span style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>{locale === 'nl' ? 'nu' : 'now'}</span>
                  </div>
                </div>

                {/* Email body */}
                <div style={{ padding: '24px 26px 30px', position: 'relative' }}>
                  <div style={{
                    fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
                    fontSize: 18, letterSpacing: '-0.2px', color: 'var(--earth)', marginBottom: 16,
                  }}>
                    {previewSubject}
                  </div>
                  <div style={{
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 400, fontSize: 15, lineHeight: 1.78, color: '#3a3128',
                  }}>
                    {activeTemplate.trim()
                      ? buildHighlightedPreview(activeTemplate, sampleVars)
                      : <span style={{ color: '#a8997c', fontStyle: 'italic' }}>{t('previewEmpty')}</span>}
                  </div>

                  {/* Stamp */}
                  <div style={{
                    position: 'absolute', right: 22, bottom: 20,
                    width: 40, height: 40, borderRadius: 9999,
                    background: 'var(--amber)', boxShadow: '0 6px 16px rgba(212,130,10,0.34)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: 'rotate(-8deg)',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <div key="whatsapp" style={{
                borderRadius: 18, overflow: 'hidden',
                boxShadow: '0 16px 40px rgba(40,30,10,0.13)', border: '1px solid #d8d0c2',
                animation: 'tfRise 0.25s ease',
              }}>
                {/* WA header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 16px', background: '#075e54',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 9999, flexShrink: 0,
                    background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
                      fontSize: 14, color: '#3a2a0e',
                    }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
                      fontSize: 14.5, color: 'white', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{restaurantName}</div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
                      fontSize: 12, color: '#95d6c8', marginTop: 1,
                    }}>{locale === 'nl' ? 'online' : 'online'}</div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cdeae3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.1 4.18 2 2 0 015.09 2h3a2 2 0 012 1.72c.13 1 .37 1.97.73 2.9a2 2 0 01-.45 2.11L9.09 9.91a16 16 0 006.99 6.99l1.18-1.18a2 2 0 012.11-.45c.93.36 1.9.6 2.9.73A2 2 0 0122 16.92z" />
                  </svg>
                </div>

                {/* WA body */}
                <div style={{
                  padding: '22px 16px 26px', minHeight: 240,
                  background: '#ece5dd',
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}>
                  <div style={{
                    maxWidth: '90%', background: 'white', borderRadius: 11,
                    borderTopLeftRadius: 2, padding: '11px 14px 8px',
                    boxShadow: '0 1px 1.5px rgba(0,0,0,0.1)',
                  }}>
                    <div style={{
                      whiteSpace: 'pre-wrap', fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 400, fontSize: 14.5, lineHeight: 1.6, color: '#303030',
                    }}>
                      {activeTemplate.trim()
                        ? buildHighlightedPreview(activeTemplate, sampleVars)
                        : <span style={{ color: '#a8997c', fontStyle: 'italic' }}>{t('previewEmpty')}</span>}
                    </div>
                    <div style={{
                      textAlign: 'right', fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 400, fontSize: 11, color: '#9aa39e', marginTop: 4,
                    }}>19:32</div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview note */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#9a8e7b' }}>
              <div style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--sage)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>
                {previewChannel === 'Email' ? t('previewNoteEmail') : t('previewNoteWhatsApp')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Questions during booking ──────────────────────────────── */}
      <div>
        {/* Section label row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 6 }}>
          <h2 className="guests-section-heading">{t('questionsHeading')}</h2>
          {/* Count pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
            background: 'var(--sage-bg)', border: '1px solid #d6e0b8', color: '#5a7330',
            fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700, fontSize: 12.5,
            padding: '7px 14px', borderRadius: 9999,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: 'var(--sage)', flexShrink: 0 }} />
            {locale === 'en'
              ? `${questionsOnCount} of 3 on`
              : `${questionsOnCount} van 3 aan`}
          </div>
        </div>
        <p style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
          fontSize: 14.5, lineHeight: 1.5, color: '#8a7e6a', margin: '0 0 22px',
        }}>
          {t('questionsSub')}
        </p>

        {/* Question cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <QuestionCard
            iconBg="var(--sage-bg)" iconColor="var(--sage)"
            iconPath="M5 3v8a2 2 0 004 0V3M7 11v10M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"
            title={t('questionAllergiesLabel')}
            description={t('questionAllergiesDescription')}
            isOn={questionAllergies}
            onToggle={handleAllergiesChange}
          >
            <ChipList chips={allergyChips} />
          </QuestionCard>

          <QuestionCard
            iconBg="#f7e8e6" iconColor="var(--burgundy)"
            iconPath="M5 11h14v9H5zM3 11h18M12 11V7M12 7a2.5 2.5 0 11-2.2-2.5C11 4.5 12 7 12 7zM12 7a2.5 2.5 0 102.2-2.5C13 4.5 12 7 12 7z"
            title={t('questionOccasionLabel')}
            description={t('questionOccasionDescription')}
            isOn={questionOccasion}
            onToggle={handleOccasionChange}
          >
            <ChipList chips={occasionChips} />
          </QuestionCard>

          <QuestionCard
            iconBg="var(--amber-bg)" iconColor="var(--amber-deep)"
            iconPath="M4 5h16v11H8l-4 4zM8 9h8M8 12.5h5"
            title={t('questionRequestsLabel')}
            description={t('questionRequestsDescription')}
            isOn={questionRequests}
            onToggle={handleRequestsChange}
          >
            <div style={{
              background: 'white', border: '1px solid #e2d7c1', borderRadius: 12,
              padding: '13px 15px',
              fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
              fontStyle: 'italic', fontSize: 14, color: '#a8997c',
            }}>
              {locale === 'nl'
                ? 'bijv. tafel bij het raam, rolstoeltoegankelijk, kinderstoel…'
                : 'e.g. window table, wheelchair access, high chair for a toddler…'}
            </div>
          </QuestionCard>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────────── */}
      {submitError && (
        <div style={{
          padding: '12px 16px', background: '#f7e8e6', border: '1px solid #e0aea0',
          borderRadius: 12, color: '#a13434', marginBottom: 16,
          fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: 14,
        }}>
          {submitError}
        </div>
      )}

    </StepFrame>
  )
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

function QuestionCard({
  iconBg, iconColor, iconPath, title, description, isOn, onToggle, children,
}: {
  iconBg: string
  iconColor: string
  iconPath: string
  title: string
  description: string
  isOn: boolean
  onToggle: (val: boolean) => void
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="guests-question-card"
      onClick={() => onToggle(!isOn)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#f4ecdd', border: `1px solid ${hovered ? '#e0cf9e' : '#e7ddc9'}`,
        borderRadius: 18, padding: '22px 26px', cursor: 'pointer',
        boxShadow: hovered ? '0 6px 18px rgba(40,30,10,0.07)' : 'none',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Icon tile */}
        <div
          className="guests-question-icon-tile"
          style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
        </div>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="guests-question-title"
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900,
              fontSize: 21, lineHeight: 1.05, color: 'var(--earth)',
            }}
          >
            {title}
          </div>
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400,
            fontSize: 14, lineHeight: 1.45, color: '#7a6f5c', margin: '6px 0 0',
          }}>
            {description}
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(!isOn) }}
          style={{
            position: 'relative', width: 52, height: 30, borderRadius: 9999,
            border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
            background: isOn ? 'var(--sage)' : '#d2c6ae',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: 3, width: 24, height: 24,
            borderRadius: 9999, background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
            transform: isOn ? 'translateX(22px)' : 'translateX(0)',
            transition: 'transform 0.2s',
          }} />
        </button>
      </div>

      {/* Expansion when ON */}
      {isOn && (
        <div style={{
          marginTop: 18, paddingTop: 18, borderTop: '1px solid #e7ddc9',
          animation: 'tfRise 0.22s ease',
        }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89a80" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
            <span style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700,
              fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a89a80',
            }}>
              What the guest sees
            </span>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}

// ── ChipList ──────────────────────────────────────────────────────────────────

function ChipList({ chips }: { chips: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {chips.map((chip) => (
        <div
          key={chip}
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600,
            fontSize: 12.5, color: '#6b6051', background: 'white',
            border: '1px solid #e2d7c1', borderRadius: 9999, padding: '7px 13px',
          }}
        >
          {chip}
        </div>
      ))}
    </div>
  )
}
