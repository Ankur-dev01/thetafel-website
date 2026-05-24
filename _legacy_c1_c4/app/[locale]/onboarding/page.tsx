// app/[locale]/onboarding/page.tsx
//
// Onboarding Step 1 — Identity (KVK lookup + autofill).
//
// Per the Phase C kickoff team decision: PRD §C.2's original manual-entry
// Step 1 is replaced with a KVK-number-driven autofill flow.
//
// Two phases on the same page:
//
//   Phase 1 — Search
//     - One input: KVK number (or business name).
//     - Smart hybrid gating:
//         0 chars   → static helper line below input
//         1-2 chars → "Type at least 3 characters" hint, no API call
//         3+ chars  → debounced API call, dropdown opens with results
//         3+ chars but no matches → friendly "no results" line, no dropdown
//     - User picks a row from the dropdown.
//     - On select, /api/kvk/profile fetches the full Basisprofiel.
//
//   Phase 2 — Autofilled form
//     - Read-only summary card: legal name + legal form (locked).
//     - "Wijzig bedrijf" link resets back to Phase 1.
//     - Editable fields: display name, website, full legal address.
//     - On Continue: saveDraft for every field in sequence.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import StepLayout from '@/components/onboarding/StepLayout'
import { saveDraft } from '@/lib/restaurants/draft'

// ---- Types ----------------------------------------------------------------

type SearchResult = {
  kvkNummer: string
  handelsnaam: string
  plaats: string
}

type Profile = {
  kvkNummer: string
  legalName: string
  legalForm: string
  tradeName: string
  websiteUrl: string
  sbiCode: string
  legalAddress: {
    street: string
    houseNumber: string
    houseLetter: string
    houseNumberAddition: string
    postcode: string
    city: string
  }
}

type FormState = {
  displayName: string
  website: string
  street: string
  houseNumber: string
  houseLetter: string
  houseNumberAddition: string
  postcode: string
  city: string
}

// Client-side minimum query length. The server route accepts from 1 char,
// but KVK's name search only does whole-word matching — typing partial
// fragments (e.g. "tes") returns nothing, which feels broken to users.
// 3 characters is the sweet spot where most full Dutch words start working.
const CLIENT_MIN_QUERY_LENGTH = 3

// ---- i18n copy (inline; no translation-key file changes needed) -----------

const COPY = {
  nl: {
    eyebrow: 'Stap 1 van 6 — Identiteit',
    headingSearch: 'Vind je bedrijf.',
    subSearch:
      'Vul je KVK-nummer of bedrijfsnaam in. We halen automatisch je gegevens op uit het KVK-register.',
    headingForm: 'Controleer je gegevens.',
    subForm:
      'We hebben je gegevens gevonden. Controleer of alles klopt en pas aan waar nodig.',
    searchPlaceholder: 'Bijv. 12345678 of Restaurant Voorbeeld',
    searchLabel: 'KVK-nummer of bedrijfsnaam',
    hintIdle: 'Vul je KVK-nummer of volledige bedrijfsnaam in.',
    hintTypeMore: 'Typ minimaal 3 tekens om te zoeken.',
    hintSearching: 'Zoeken...',
    hintNoResults:
      'Geen bedrijven gevonden. Probeer een volledig woord of KVK-nummer.',
    hintError: 'Zoeken mislukt. Probeer het opnieuw.',
    profileError: 'Kon bedrijfsgegevens niet ophalen.',
    changeBusiness: 'Wijzig bedrijf',
    registeredAs: 'We registreren je als',
    displayNameLabel: 'Weergavenaam',
    displayNameHelp:
      'De naam die gasten zien op je boekingspagina. Mag afwijken van je officiële handelsnaam.',
    websiteLabel: 'Website (optioneel)',
    addressTitle: 'Bedrijfsadres (KVK)',
    streetLabel: 'Straatnaam',
    houseNumberLabel: 'Huisnummer',
    houseLetterLabel: 'Huisletter',
    houseAdditionLabel: 'Toevoeging',
    postcodeLabel: 'Postcode',
    cityLabel: 'Plaats',
    postcodeError: 'Postcode moet het formaat 1234 AB hebben.',
    continueLabel: 'Doorgaan',
    submittingLabel: 'Opslaan...',
    saveErrorGeneric: 'Opslaan mislukt. Probeer het opnieuw.',
  },
  en: {
    eyebrow: 'Step 1 of 6 — Identity',
    headingSearch: 'Find your business.',
    subSearch:
      'Enter your KVK number or business name. We will pull your details from the Dutch Chamber of Commerce register.',
    headingForm: 'Check your details.',
    subForm:
      'We found your business. Review the details below and edit anything that needs correcting.',
    searchPlaceholder: 'e.g. 12345678 or Restaurant Voorbeeld',
    searchLabel: 'KVK number or business name',
    hintIdle: 'Enter your KVK number or full business name.',
    hintTypeMore: 'Type at least 3 characters to search.',
    hintSearching: 'Searching...',
    hintNoResults:
      'No businesses found. Try a full word or complete KVK number.',
    hintError: 'Search failed. Please try again.',
    profileError: 'Could not fetch business details.',
    changeBusiness: 'Change business',
    registeredAs: 'We will register you as',
    displayNameLabel: 'Display name',
    displayNameHelp:
      'The name guests see on your booking page. May differ from your official trade name.',
    websiteLabel: 'Website (optional)',
    addressTitle: 'Business address (KVK)',
    streetLabel: 'Street',
    houseNumberLabel: 'House number',
    houseLetterLabel: 'House letter',
    houseAdditionLabel: 'Addition',
    postcodeLabel: 'Postcode',
    cityLabel: 'City',
    postcodeError: 'Postcode must be in format 1234 AB.',
    continueLabel: 'Continue',
    submittingLabel: 'Saving...',
    saveErrorGeneric: 'Save failed. Please try again.',
  },
} as const

// ---- Shared styles --------------------------------------------------------

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--stone)',
  marginBottom: '8px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '15px',
  fontWeight: 400,
  color: 'var(--earth)',
  backgroundColor: 'var(--cream)',
  border: '1px solid rgba(156,139,106,0.25)',
  borderRadius: '12px',
  outline: 'none',
  boxSizing: 'border-box',
}

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: '1px solid #fecaca',
}

const fieldHelpStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 300,
  lineHeight: 1.5,
  color: 'var(--stone)',
}

const fieldErrorStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  color: '#dc2626',
}

// Helper text style (slightly different from fieldHelpStyle — softer when
// it's just guidance, amber when nudging the user to type more).
const helperStyle: React.CSSProperties = {
  marginTop: '10px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '13px',
  fontWeight: 400,
  lineHeight: 1.5,
  color: 'var(--stone)',
}

const helperNudgeStyle: React.CSSProperties = {
  ...helperStyle,
  color: 'var(--amber)',
}

const helperErrorStyle: React.CSSProperties = {
  ...helperStyle,
  color: '#dc2626',
}

// ---- Helpers --------------------------------------------------------------

const POSTCODE_REGEX = /^\d{4}\s?[A-Za-z]{2}$/

function normalisePostcode(v: string): string {
  return v.trim().replace(/\s+/g, '').toUpperCase()
}

function formatPostcodeForDisplay(v: string): string {
  const cleaned = normalisePostcode(v)
  if (cleaned.length !== 6) return v
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`
}

function buildFormFromProfile(p: Profile): FormState {
  return {
    displayName: p.tradeName || p.legalName,
    website: p.websiteUrl,
    street: p.legalAddress.street,
    houseNumber: p.legalAddress.houseNumber,
    houseLetter: p.legalAddress.houseLetter,
    houseNumberAddition: p.legalAddress.houseNumberAddition,
    postcode: formatPostcodeForDisplay(p.legalAddress.postcode),
    city: p.legalAddress.city,
  }
}

// ---- Component ------------------------------------------------------------

type SearchStatus =
  | 'idle' // nothing typed
  | 'too-short' // 1-2 chars typed
  | 'searching' // request in flight
  | 'has-results' // got matches
  | 'no-results' // request done, empty list
  | 'error' // request failed (network/server)

export default function OnboardingStep1Page() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''
  const t = COPY[locale]

  // Phase state
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<FormState | null>(null)

  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Profile-fetch state
  const [profileLoading, setProfileLoading] = useState(false)

  // Form validation/save state
  const [postcodeError, setPostcodeError] = useState<string | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Refs for debounce + abort
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)

  // Debounced typeahead with smart gating
  useEffect(() => {
    if (profile) return // search disabled in Phase 2

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmed = query.trim()

    // 0 chars → idle, dropdown closed, no API call
    if (trimmed.length === 0) {
      setStatus('idle')
      setResults([])
      setDropdownOpen(false)
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
        searchAbortRef.current = null
      }
      return
    }

    // 1-2 chars → "type more" nudge, dropdown closed, no API call
    if (trimmed.length < CLIENT_MIN_QUERY_LENGTH) {
      setStatus('too-short')
      setResults([])
      setDropdownOpen(false)
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
        searchAbortRef.current = null
      }
      return
    }

    // 3+ chars → debounced API call
    debounceTimerRef.current = setTimeout(async () => {
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
      }
      const controller = new AbortController()
      searchAbortRef.current = controller
      setStatus('searching')

      try {
        const res = await fetch(
          `/api/kvk/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, cache: 'no-store' }
        )
        if (!res.ok) {
          setResults([])
          setStatus('error')
          setDropdownOpen(false)
          return
        }
        const data = (await res.json()) as { results?: SearchResult[] }
        const list = Array.isArray(data.results) ? data.results : []
        setResults(list)
        if (list.length > 0) {
          setStatus('has-results')
          setDropdownOpen(true)
        } else {
          setStatus('no-results')
          setDropdownOpen(false)
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setResults([])
        setStatus('error')
        setDropdownOpen(false)
      }
    }, 400)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query, profile])

  // Click-outside closes dropdown
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!dropdownContainerRef.current) return
      if (!dropdownContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // Escape closes dropdown
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Handle picking a search result
  const handlePickResult = useCallback(
    async (result: SearchResult) => {
      setDropdownOpen(false)
      setProfileLoading(true)
      setCardError(null)
      try {
        const res = await fetch('/api/kvk/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kvkNummer: result.kvkNummer }),
          cache: 'no-store',
        })
        if (!res.ok) {
          setCardError(t.profileError)
          return
        }
        const data = (await res.json()) as Profile
        setProfile(data)
        setForm(buildFormFromProfile(data))
        // Clear search state — Phase 1 controls vanish.
        setQuery('')
        setResults([])
        setStatus('idle')
      } catch {
        setCardError(t.profileError)
      } finally {
        setProfileLoading(false)
      }
    },
    [t.profileError]
  )

  // Reset to Phase 1
  const handleChangeBusiness = useCallback(() => {
    setProfile(null)
    setForm(null)
    setPostcodeError(null)
    setCardError(null)
    setQuery('')
    setResults([])
    setStatus('idle')
    setDropdownOpen(false)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [])

  // Form field updates
  const updateForm = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    []
  )

  // Postcode live validation
  const handlePostcodeChange = useCallback(
    (raw: string) => {
      updateForm('postcode', raw)
      const trimmed = raw.trim()
      if (trimmed.length === 0) {
        setPostcodeError(null)
        return
      }
      if (POSTCODE_REGEX.test(trimmed)) {
        setPostcodeError(null)
      } else if (trimmed.length >= 6) {
        setPostcodeError(t.postcodeError)
      } else {
        setPostcodeError(null)
      }
    },
    [t.postcodeError, updateForm]
  )

  // Continue enable logic
  const canContinue = (() => {
    if (!profile || !form) return false
    if (submitting) return false
    if (postcodeError) return false
    if (form.displayName.trim().length === 0) return false
    if (form.street.trim().length === 0) return false
    if (form.houseNumber.trim().length === 0) return false
    if (form.city.trim().length === 0) return false
    if (!POSTCODE_REGEX.test(form.postcode.trim())) return false
    return true
  })()

  // On Continue: sequential saveDraft calls, kvk_number first.
  const handleContinue = useCallback(async () => {
    if (!profile || !form) return
    setSubmitting(true)
    setCardError(null)

    type DraftWrite = { field: string; value: string | null }
    const writes: DraftWrite[] = [
      { field: 'kvk_number', value: profile.kvkNummer },
      { field: 'legal_name', value: profile.legalName || null },
      { field: 'legal_form', value: profile.legalForm || null },
      { field: 'sbi_code', value: profile.sbiCode || null },
      { field: 'display_name', value: form.displayName.trim() },
      {
        field: 'website',
        value: form.website.trim().length > 0 ? form.website.trim() : null,
      },
      { field: 'legal_address_street', value: form.street.trim() },
      { field: 'legal_address_house_number', value: form.houseNumber.trim() },
      {
        field: 'legal_address_house_letter',
        value:
          form.houseLetter.trim().length > 0
            ? form.houseLetter.trim()
            : null,
      },
      {
        field: 'legal_address_house_number_addition',
        value:
          form.houseNumberAddition.trim().length > 0
            ? form.houseNumberAddition.trim()
            : null,
      },
      {
        field: 'legal_address_postcode',
        value: normalisePostcode(form.postcode),
      },
      { field: 'legal_address_city', value: form.city.trim() },
    ]

    for (const w of writes) {
      const res = await saveDraft(w.field, w.value)
      if (!res.ok) {
        setCardError(res.error || t.saveErrorGeneric)
        setSubmitting(false)
        return
      }
    }

    router.push(`${localePrefix}/onboarding/step/2`)
  }, [profile, form, router, localePrefix, t.saveErrorGeneric])

  // ---- Helper text resolution --------------------------------------------
  // Returns [text, styleVariant]. The variant decides which color the text
  // gets ('neutral' = stone, 'nudge' = amber, 'error' = red).
  function resolveHelper(): {
    text: string
    variant: 'neutral' | 'nudge' | 'error'
  } | null {
    switch (status) {
      case 'idle':
        return { text: t.hintIdle, variant: 'neutral' }
      case 'too-short':
        return { text: t.hintTypeMore, variant: 'nudge' }
      case 'searching':
        return { text: t.hintSearching, variant: 'neutral' }
      case 'no-results':
        return { text: t.hintNoResults, variant: 'neutral' }
      case 'error':
        return { text: t.hintError, variant: 'error' }
      case 'has-results':
        // Dropdown is showing — no helper text needed.
        return null
      default:
        return null
    }
  }

  // ---- Render -------------------------------------------------------------

  const inPhase2 = profile !== null && form !== null
  const heading = inPhase2 ? t.headingForm : t.headingSearch
  const sub = inPhase2 ? t.subForm : t.subSearch
  const helper = !inPhase2 ? resolveHelper() : null

  return (
    <StepLayout
      currentStep={1}
      totalSteps={6}
      eyebrow={t.eyebrow}
      heading={heading}
      sub={sub}
      backHref={null}
      continueLabel={t.continueLabel}
      submittingLabel={t.submittingLabel}
      canContinue={inPhase2 ? canContinue : false}
      isSubmitting={submitting}
      onContinue={handleContinue}
      error={cardError}
    >
      {!inPhase2 ? (
        // ---- Phase 1: Search ----
        <div ref={dropdownContainerRef} style={{ position: 'relative' }}>
          <label style={labelStyle} htmlFor="kvk-search">
            {t.searchLabel}
          </label>
          <input
            id="kvk-search"
            ref={searchInputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={query}
            placeholder={t.searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (status === 'has-results') setDropdownOpen(true)
            }}
            disabled={profileLoading}
            style={inputStyle}
          />

          {/* Helper line */}
          {helper && (
            <div
              style={
                helper.variant === 'nudge'
                  ? helperNudgeStyle
                  : helper.variant === 'error'
                    ? helperErrorStyle
                    : helperStyle
              }
            >
              {helper.text}
            </div>
          )}

          {/* Dropdown — only rendered when we actually have results */}
          {dropdownOpen && results.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                backgroundColor: 'var(--cream)',
                borderRadius: '12px',
                boxShadow:
                  '0 8px 24px rgba(30,21,8,0.08), 0 2px 6px rgba(30,21,8,0.04)',
                maxHeight: '320px',
                overflowY: 'auto',
                zIndex: 10,
              }}
            >
              {results.map((r, idx) => (
                <button
                  key={`${r.kvkNummer}-${idx}`}
                  type="button"
                  onClick={() => handlePickResult(r)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom:
                      idx < results.length - 1
                        ? '1px solid rgba(156,139,106,0.12)'
                        : 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-jost), sans-serif',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'var(--warm)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      'transparent'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--earth)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.handelsnaam}
                    </div>
                    <div
                      style={{
                        marginTop: '2px',
                        fontSize: '12px',
                        fontWeight: 400,
                        color: 'var(--stone)',
                      }}
                    >
                      {r.kvkNummer}
                      {r.plaats ? ` · ${r.plaats}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {profileLoading && (
            <div
              style={{
                marginTop: '20px',
                padding: '14px 16px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                color: 'var(--stone)',
              }}
            >
              ...
            </div>
          )}
        </div>
      ) : (
        // ---- Phase 2: Autofilled form ----
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary card */}
          <div
            style={{
              padding: '16px 18px',
              borderRadius: '12px',
              backgroundColor: 'var(--cream)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--stone)',
                marginBottom: '8px',
              }}
            >
              {t.registeredAs}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--earth)',
                marginBottom: '4px',
              }}
            >
              {profile.legalName}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--stone)',
              }}
            >
              KVK {profile.kvkNummer}
              {profile.legalForm ? ` · ${profile.legalForm}` : ''}
            </div>
            <button
              type="button"
              onClick={handleChangeBusiness}
              style={{
                marginTop: '12px',
                padding: 0,
                backgroundColor: 'transparent',
                border: 'none',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--amber)',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              {t.changeBusiness}
            </button>
          </div>

          {/* Display name */}
          <div>
            <label style={labelStyle} htmlFor="display-name">
              {t.displayNameLabel}
            </label>
            <input
              id="display-name"
              type="text"
              autoComplete="off"
              value={form.displayName}
              onChange={(e) => updateForm('displayName', e.target.value)}
              style={inputStyle}
              maxLength={120}
            />
            <div style={fieldHelpStyle}>{t.displayNameHelp}</div>
          </div>

          {/* Website */}
          <div>
            <label style={labelStyle} htmlFor="website">
              {t.websiteLabel}
            </label>
            <input
              id="website"
              type="url"
              autoComplete="off"
              placeholder="https://"
              value={form.website}
              onChange={(e) => updateForm('website', e.target.value)}
              style={inputStyle}
              maxLength={500}
            />
          </div>

          {/* Address title */}
          <div
            style={{
              marginTop: '12px',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--stone)',
            }}
          >
            {t.addressTitle}
          </div>

          {/* Street + house number row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px',
              gap: '12px',
            }}
          >
            <div>
              <label style={labelStyle} htmlFor="street">
                {t.streetLabel}
              </label>
              <input
                id="street"
                type="text"
                autoComplete="off"
                value={form.street}
                onChange={(e) => updateForm('street', e.target.value)}
                style={inputStyle}
                maxLength={120}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="house-number">
                {t.houseNumberLabel}
              </label>
              <input
                id="house-number"
                type="text"
                autoComplete="off"
                value={form.houseNumber}
                onChange={(e) => updateForm('houseNumber', e.target.value)}
                style={inputStyle}
                maxLength={20}
              />
            </div>
          </div>

          {/* House letter + addition row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div>
              <label style={labelStyle} htmlFor="house-letter">
                {t.houseLetterLabel}
              </label>
              <input
                id="house-letter"
                type="text"
                autoComplete="off"
                value={form.houseLetter}
                onChange={(e) => updateForm('houseLetter', e.target.value)}
                style={inputStyle}
                maxLength={10}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="house-addition">
                {t.houseAdditionLabel}
              </label>
              <input
                id="house-addition"
                type="text"
                autoComplete="off"
                value={form.houseNumberAddition}
                onChange={(e) =>
                  updateForm('houseNumberAddition', e.target.value)
                }
                style={inputStyle}
                maxLength={20}
              />
            </div>
          </div>

          {/* Postcode + city row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr',
              gap: '12px',
            }}
          >
            <div>
              <label style={labelStyle} htmlFor="postcode">
                {t.postcodeLabel}
              </label>
              <input
                id="postcode"
                type="text"
                autoComplete="off"
                value={form.postcode}
                onChange={(e) => handlePostcodeChange(e.target.value)}
                style={postcodeError ? inputErrorStyle : inputStyle}
                maxLength={7}
              />
              {postcodeError && (
                <div style={fieldErrorStyle}>{postcodeError}</div>
              )}
            </div>
            <div>
              <label style={labelStyle} htmlFor="city">
                {t.cityLabel}
              </label>
              <input
                id="city"
                type="text"
                autoComplete="off"
                value={form.city}
                onChange={(e) => updateForm('city', e.target.value)}
                style={inputStyle}
                maxLength={100}
              />
            </div>
          </div>
        </div>
      )}
    </StepLayout>
  )
}
