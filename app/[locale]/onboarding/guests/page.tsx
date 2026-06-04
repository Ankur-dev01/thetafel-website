'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import ToggleField from '@/components/onboarding/fields/ToggleField'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'

// ---- Default templates -------------------------------------------------------
// Variable tokens stay Dutch in both locales — they are functional placeholders.

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

// ---- Sample preview values ---------------------------------------------------

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

// ---- Helpers -----------------------------------------------------------------

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

function applyPreview(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [token, val]) => acc.split(token).join(val),
    template
  )
}

// ---- Page --------------------------------------------------------------------

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

  // Submit / misc
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- Hydration -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHydrated(true)
          return
        }
        const data = (await res.json()) as Record<string, unknown>
        if (cancelled) return

        const r = (data?.restaurant ?? {}) as Record<string, unknown>

        try {
          const visibleSteps = getVisibleSteps(
            r as Parameters<typeof getVisibleSteps>[0]
          )
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(6, visibleSteps) ?? 6)
        } catch {
          // leave defaults
        }

        const nlVal =
          typeof r.confirmation_template_nl === 'string' && r.confirmation_template_nl.length > 0
            ? r.confirmation_template_nl
            : DEFAULT_TEMPLATE_NL
        const enVal =
          typeof r.confirmation_template_en === 'string' && r.confirmation_template_en.length > 0
            ? r.confirmation_template_en
            : DEFAULT_TEMPLATE_EN

        setTemplateNl(nlVal)
        setTemplateEn(enVal)

        setQuestionAllergies(parseBool(r.booking_question_allergies, true))
        setQuestionOccasion(parseBool(r.booking_question_occasion, true))
        setQuestionRequests(parseBool(r.booking_question_requests, true))

        if (!cancelled) setHydrated(true)
      } catch {
        if (!cancelled) setHydrated(true)
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [pathname])

  // ---- Build patch -----------------------------------------------------------

  function buildGuestsPatch() {
    return {
      confirmation_template_nl: templateNl,
      confirmation_template_en: templateEn,
      booking_question_allergies: questionAllergies,
      booking_question_occasion: questionOccasion,
      booking_question_requests: questionRequests,
    }
  }

  // ---- Template handlers -----------------------------------------------------

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

  // ---- Question handlers -----------------------------------------------------

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

  // ---- Continue handler ------------------------------------------------------

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

  // ---- Derived ---------------------------------------------------------------

  const activeTemplate = editingLocale === 'nl' ? templateNl : templateEn
  const sampleVars = editingLocale === 'nl' ? SAMPLE_VARS_NL : SAMPLE_VARS_EN
  const previewText = activeTemplate.trim() ? applyPreview(activeTemplate, sampleVars) : null

  const backHref = previousStepPath(6, visibleStepIds, locale) ?? stepPath(5, locale)

  // ---- Render ----------------------------------------------------------------

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      serviceTag={t('serviceTag')}
      heading={t('heading')}
      subHeading={t('sub')}
      backHref={backHref}
      canContinue={true}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        .guests-template-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 920px) {
          .guests-template-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Section A — Confirmation template */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              color: '#1e1508',
              marginBottom: '4px',
            }}>
              {t('templateHeading')}
            </div>
            <div style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 400,
              fontSize: '13px',
              color: '#9c8b6a',
            }}>
              {t('templateSub')}
            </div>
          </div>

          <div className="guests-template-grid">
            {/* Left column — editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Locale tabs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['nl', 'en'] as const).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setEditingLocale(loc)}
                    style={{
                      width: '64px',
                      height: '32px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: editingLocale === loc ? '#d4820a' : 'transparent',
                      color: editingLocale === loc ? '#fff' : '#9c8b6a',
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s, color 0.15s',
                    }}
                  >
                    {loc === 'nl' ? t('tabNl') : t('tabEn')}
                  </button>
                ))}
              </div>

              {/* Variable pill row */}
              <div>
                <div style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: '#9c8b6a',
                  marginBottom: '8px',
                }}>
                  {t('variablesHint')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {TEMPLATE_TOKENS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertToken(token)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(212,130,10,0.12)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8f2e6'
                      }}
                      style={{
                        backgroundColor: '#f8f2e6',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontFamily: "'Jost', monospace, sans-serif",
                        fontWeight: 500,
                        fontSize: '12px',
                        color: '#1e1508',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea + char counter */}
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={textareaRef}
                  value={activeTemplate}
                  placeholder={t('templatePlaceholder')}
                  maxLength={5000}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(212,130,10,0.5)'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(212,130,10,0.08)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  style={{
                    width: '100%',
                    minHeight: '240px',
                    padding: '14px 18px 32px',
                    backgroundColor: '#f8f2e6',
                    border: '1.5px solid transparent',
                    borderRadius: '12px',
                    fontFamily: "'Jost', monospace, sans-serif",
                    fontSize: '15px',
                    fontWeight: 400,
                    color: '#1e1508',
                    lineHeight: 1.6,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '14px',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: '#9c8b6a',
                  pointerEvents: 'none',
                }}>
                  {t('charCount', { count: activeTemplate.length })}
                </span>
              </div>
            </div>

            {/* Right column — live preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 600,
                fontSize: '13px',
                color: '#9c8b6a',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
                marginBottom: '4px',
              }}>
                {t('previewHeading')}
              </div>
              <div style={{
                backgroundColor: '#fdfaf5',
                borderRadius: '12px',
                padding: '20px',
                minHeight: '240px',
                flex: 1,
              }}>
                {previewText ? (
                  <div style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'Jost, sans-serif',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    color: '#1e1508',
                  }}>
                    {previewText}
                  </div>
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: '#9c8b6a',
                    fontStyle: 'italic',
                  }}>
                    {t('previewEmpty')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section B — Booking questions */}
        <div>
          <h2 style={{
            margin: '0 0 8px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: '18px',
            color: '#1e1508',
          }}>
            {t('questionsHeading')}
          </h2>
          <p style={{
            margin: '0 0 20px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            color: '#9c8b6a',
          }}>
            {t('questionsSub')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ToggleField
              label={t('questionAllergiesLabel')}
              description={t('questionAllergiesDescription')}
              value={questionAllergies}
              onChange={handleAllergiesChange}
            />
            <ToggleField
              label={t('questionOccasionLabel')}
              description={t('questionOccasionDescription')}
              value={questionOccasion}
              onChange={handleOccasionChange}
            />
            <ToggleField
              label={t('questionRequestsLabel')}
              description={t('questionRequestsDescription')}
              value={questionRequests}
              onChange={handleRequestsChange}
            />
          </div>
        </div>

      </div>
    </StepFrame>
  )
}
