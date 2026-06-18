'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import {
  getVisibleSteps,
  getTotalWizardSteps,
} from '@/lib/onboarding/steps'
import { stepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'
import type { DraftSaveState } from '@/lib/onboarding/useDraftSave'

// ---- Types ------------------------------------------------------------------

type SearchResult = {
  kvkNummer: string
  handelsnaam: string
  plaats: string
}

type LegalAddress = {
  street: string
  houseNumber: string
  houseLetter: string
  houseNumberAddition: string
  postcode: string
  city: string
}

type Profile = {
  kvkNummer: string
  legalName: string
  legalForm: string
  tradeName: string
  websiteUrl: string
  sbiCode: string
  legalAddress: LegalAddress
}

type SearchStatus =
  | 'idle'
  | 'too-short'
  | 'searching'
  | 'has-results'
  | 'no-results'
  | 'error'

// ---- Module-level helpers ---------------------------------------------------

const CLIENT_MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 400

function isValidDutchPhone(p: string): boolean {
  if (!p.trim()) return true
  return /^(\+31|0)[0-9\s\-.()]{7,14}$/.test(p.trim())
}

function isValidEmail(e: string): boolean {
  if (!e.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}

function normalizeWebsite(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isValidWebsite(url: string): boolean {
  if (!url.trim()) return true
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// ---- Eyebrow label for form fields ------------------------------------------

function FieldLabel({
  htmlFor,
  text,
  required,
}: {
  htmlFor?: string
  text: string
  required?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '11px',
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.13em',
          textTransform: 'uppercase' as const,
          color: '#9a8259',
          cursor: htmlFor ? 'default' : undefined,
        }}
      >
        {text}
      </label>
      {required && (
        <span style={{ color: 'var(--amber)', fontSize: '12px', lineHeight: 1 }}>*</span>
      )}
    </div>
  )
}

// ---- Icon tile (inside inputs) ---------------------------------------------

function InputIconTile({
  bg,
  color,
  children,
}: {
  bg: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '14px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '30px',
        height: '30px',
        borderRadius: '9px',
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <div style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ---- Component --------------------------------------------------------------

export default function BusinessVerificationPage() {
  const t = useTranslations('onboarding.business')
  const params = useParams()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, saveNow } = useDraftSave()

  // ---- Hydration state ----------------------------------------------------
  const [hydrating, setHydrating] = useState(true)
  const [hydrationError, setHydrationError] = useState<string | null>(null)
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])

  // ---- Phase 1: search ----------------------------------------------------
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  // ---- Phase 2: profile card ----------------------------------------------
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  // ---- Phase 2: editable form ---------------------------------------------
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [website, setWebsite] = useState('')

  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [cuisineError, setCuisineError] = useState<string | null>(null)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  const [isContinuing, setIsContinuing] = useState(false)

  // Focus tracking for amber focus ring ----------------------------------------
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // "Change business" link hover
  const [changeHovered, setChangeHovered] = useState(false)

  // Refs -----------------------------------------------------------------------
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null)

  // ---- Hydrate from existing draft ----------------------------------------
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHydrating(false)
          return
        }
        const data = await res.json()

        const r =
          data?.restaurant ??
          data?.data?.restaurant ??
          data?.draft?.restaurant ??
          data

        if (!cancelled && r && typeof r === 'object') {
          try {
            const visibleSteps = getVisibleSteps(r)
            const ids = visibleSteps.map((s) => s.id)
            setTotalSteps(getTotalWizardSteps(visibleSteps))
            setVisibleStepIds(ids)
          } catch {
            // leave defaults
          }

          const hasKvk =
            typeof r.kvk_number === 'string' && /^\d{8}$/.test(r.kvk_number)
          if (hasKvk) {
            setProfile({
              kvkNummer: r.kvk_number,
              legalName: r.legal_name ?? '',
              legalForm: r.legal_form ?? '',
              tradeName: r.trade_name ?? '',
              websiteUrl: r.website ?? '',
              sbiCode: r.sbi_code ?? '',
              legalAddress: {
                street: r.legal_address_street ?? '',
                houseNumber: r.legal_address_house_number ?? '',
                houseLetter: r.legal_address_house_letter ?? '',
                houseNumberAddition:
                  r.legal_address_house_number_addition ?? '',
                postcode: r.legal_address_postcode ?? '',
                city: r.legal_address_city ?? '',
              },
            })
            setDisplayName(r.display_name ?? r.trade_name ?? r.legal_name ?? '')
            setPhone(r.contact_phone ?? '')
            setEmail(r.contact_email ?? '')
            setCuisine(r.cuisine_type ?? '')
            setWebsite(r.website ?? '')
          }
        }
      } catch {
        if (!cancelled) {
          setHydrationError(t('errors.hydrate'))
        }
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [t, pathname])

  // ---- Debounced typeahead ------------------------------------------------
  useEffect(() => {
    if (profile) return
    if (hydrating) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmed = query.trim()

    if (trimmed.length === 0) {
      setStatus('idle')
      setResults([])
      setDropdownOpen(false)
      setHighlightIndex(-1)
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
        searchAbortRef.current = null
      }
      return
    }

    if (trimmed.length < CLIENT_MIN_QUERY_LENGTH) {
      setStatus('too-short')
      setResults([])
      setDropdownOpen(false)
      setHighlightIndex(-1)
      if (searchAbortRef.current) {
        searchAbortRef.current.abort()
        searchAbortRef.current = null
      }
      return
    }

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
          setHighlightIndex(-1)
          return
        }
        const data = await res.json()
        const list: SearchResult[] = Array.isArray(data?.results)
          ? data.results.filter(
              (r: unknown): r is SearchResult =>
                typeof r === 'object' &&
                r !== null &&
                typeof (r as SearchResult).kvkNummer === 'string' &&
                typeof (r as SearchResult).handelsnaam === 'string'
            )
          : []

        setResults(list)
        if (list.length > 0) {
          setStatus('has-results')
          setDropdownOpen(true)
          setHighlightIndex(0)
        } else {
          setStatus('no-results')
          setDropdownOpen(false)
          setHighlightIndex(-1)
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setResults([])
        setStatus('error')
        setDropdownOpen(false)
        setHighlightIndex(-1)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [query, profile, hydrating])

  // ---- Click-outside closes dropdown --------------------------------------
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

  // ---- Pick result → fetch profile + persist KVK --------------------------
  const handlePickResult = useCallback(
    async (result: SearchResult) => {
      setDropdownOpen(false)
      setProfileLoading(true)
      setCardError(null)
      try {
        const profileRes = await fetch('/api/kvk/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kvkNummer: result.kvkNummer }),
          cache: 'no-store',
        })
        if (!profileRes.ok) {
          setCardError(t('errors.profileFetch'))
          return
        }
        const data = (await profileRes.json()) as Profile

        if (!data || typeof data.kvkNummer !== 'string') {
          setCardError(t('errors.profileFetch'))
          return
        }

        const patchRes = await fetch('/api/v1/restaurants/draft', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurant: {
              kvk_number: data.kvkNummer,
              legal_name: data.legalName,
              trade_name: data.tradeName,
              legal_form: data.legalForm,
              sbi_code: data.sbiCode,
              legal_address_street: data.legalAddress.street,
              legal_address_house_number: data.legalAddress.houseNumber,
              legal_address_house_letter: data.legalAddress.houseLetter,
              legal_address_house_number_addition:
                data.legalAddress.houseNumberAddition,
              legal_address_postcode: data.legalAddress.postcode,
              legal_address_city: data.legalAddress.city,
              kvk_verified_at: new Date().toISOString(),
            },
          }),
          cache: 'no-store',
        })

        if (patchRes.status === 409) {
          setCardError(t('phase2.kvkAlreadyLinked'))
          return
        }
        if (!patchRes.ok) {
          setCardError(t('errors.saveFailed'))
          return
        }

        setProfile(data)
        setDisplayName(data.tradeName || data.legalName || '')
        setWebsite(data.websiteUrl || '')
        setPhone('')
        setEmail('')
        setCuisine('')
        setDisplayNameError(null)
        setPhoneError(null)
        setEmailError(null)
        setCuisineError(null)
        setWebsiteError(null)

        setQuery('')
        setResults([])
        setStatus('idle')
        setHighlightIndex(-1)
      } catch {
        setCardError(t('errors.profileFetch'))
      } finally {
        setProfileLoading(false)
      }
    },
    [t]
  )

  // ---- Keyboard nav -------------------------------------------------------
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!dropdownOpen || results.length === 0) {
        if (e.key === 'Escape') setDropdownOpen(false)
        return
      }
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((i) => (i + 1) % results.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((i) => (i - 1 + results.length) % results.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const picked = results[highlightIndex]
        if (picked) void handlePickResult(picked)
      }
    },
    [dropdownOpen, results, highlightIndex, handlePickResult]
  )

  // ---- Change business → back to Phase 1 ----------------------------------
  const handleChangeBusiness = useCallback(() => {
    setProfile(null)
    setCardError(null)
    setQuery('')
    setResults([])
    setStatus('idle')
    setHighlightIndex(-1)
    setDropdownOpen(false)
    setDisplayName('')
    setPhone('')
    setEmail('')
    setCuisine('')
    setWebsite('')
    setDisplayNameError(null)
    setPhoneError(null)
    setEmailError(null)
    setCuisineError(null)
    setWebsiteError(null)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [])

  // ---- Per-field blur handlers --------------------------------------------

  const handleDisplayNameBlur = useCallback(() => {
    setFocusedField(null)
    if (!displayName.trim()) {
      setDisplayNameError(t('errors.displayNameRequired'))
      return
    }
    setDisplayNameError(null)
    void saveNow({ restaurant: { display_name: displayName.trim() } })
  }, [displayName, saveNow, t])

  const handlePhoneBlur = useCallback(() => {
    setFocusedField(null)
    if (phone.trim() && !isValidDutchPhone(phone)) {
      setPhoneError(t('errors.phoneInvalid'))
      return
    }
    setPhoneError(null)
    void saveNow({ restaurant: { contact_phone: phone.trim() } })
  }, [phone, saveNow, t])

  const handleEmailBlur = useCallback(() => {
    setFocusedField(null)
    if (email.trim() && !isValidEmail(email)) {
      setEmailError(t('errors.emailInvalid'))
      return
    }
    setEmailError(null)
    if (email.trim()) {
      void saveNow({ restaurant: { contact_email: email.trim() } })
    }
  }, [email, saveNow, t])

  const handleCuisineChange = useCallback((val: string) => {
    setCuisine(val)
    if (val) setCuisineError(null)
  }, [])

  const handleCuisineBlur = useCallback(() => {
    setFocusedField(null)
    if (!cuisine) {
      setCuisineError(t('errors.cuisineRequired'))
      return
    }
    setCuisineError(null)
    void saveNow({ restaurant: { cuisine_type: cuisine } })
  }, [cuisine, saveNow, t])

  const handleWebsiteBlur = useCallback(() => {
    setFocusedField(null)
    const normalized = normalizeWebsite(website)
    setWebsite(normalized)
    if (normalized && !isValidWebsite(normalized)) {
      setWebsiteError(t('errors.websiteInvalid'))
      return
    }
    setWebsiteError(null)
    if (normalized) {
      void saveNow({ restaurant: { website: normalized } })
    }
  }, [website, saveNow, t])

  // ---- Continue handler ---------------------------------------------------
  const handleContinue = useCallback(async () => {
    if (!profile) return
    if (!displayName.trim() || !cuisine) return
    if (displayNameError || phoneError || emailError || cuisineError || websiteError) return
    if (isContinuing) return

    setIsContinuing(true)
    try {
      const currIdx = visibleStepIds.indexOf(1)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 2
      const nextPath = stepPath(nextStepId, locale)

      const restaurantPatch: Record<string, unknown> = {
        display_name: displayName.trim(),
        cuisine_type: cuisine,
        current_onboarding_step: nextStepId,
      }
      if (phone.trim()) restaurantPatch.contact_phone = phone.trim()
      if (email.trim()) restaurantPatch.contact_email = email.trim()
      if (website.trim()) restaurantPatch.website = website.trim()

      await saveNow({ restaurant: restaurantPatch })
      if (nextPath) router.push(nextPath)
    } catch {
      // saveNow already surfaces error via saveState
    } finally {
      setIsContinuing(false)
    }
  }, [
    profile,
    displayName,
    cuisine,
    phone,
    email,
    website,
    displayNameError,
    phoneError,
    emailError,
    cuisineError,
    websiteError,
    isContinuing,
    visibleStepIds,
    locale,
    saveNow,
    router,
  ])

  // ---- Derived helpers ----------------------------------------------------
  const inPhase2 = profile !== null

  const canContinue =
    inPhase2 &&
    displayName.trim().length > 0 &&
    cuisine.length > 0 &&
    !displayNameError &&
    !phoneError &&
    !emailError &&
    !cuisineError &&
    !websiteError &&
    !isContinuing

  const headingRaw = inPhase2 ? t('phase2.heading') : t('phase1.heading')
  const headingBody = headingRaw.endsWith('.') ? headingRaw.slice(0, -1) : headingRaw
  const sub = inPhase2 ? t('phase2.sub') : t('phase1.sub')

  const helperLine = useMemo(() => {
    if (inPhase2) return null
    if (profileLoading) {
      return { text: t('phase1.hintFetching'), variant: 'neutral' as const }
    }
    if (cardError) {
      return { text: cardError, variant: 'error' as const }
    }
    switch (status) {
      case 'idle':
        return { text: t('phase1.hintIdle'), variant: 'neutral' as const }
      case 'too-short':
        return { text: t('phase1.hintTypeMore'), variant: 'nudge' as const }
      case 'searching':
        return { text: t('phase1.hintSearching'), variant: 'neutral' as const }
      case 'no-results':
        return { text: t('phase1.hintNoResults'), variant: 'neutral' as const }
      case 'error':
        return { text: t('phase1.hintError'), variant: 'error' as const }
      case 'has-results':
        return null
      default:
        return null
    }
  }, [status, inPhase2, profileLoading, cardError, t])

  const cuisineOptions = useMemo(
    () => [
      { value: 'italian', label: t('cuisineOptions.italian') },
      { value: 'french', label: t('cuisineOptions.french') },
      { value: 'asian', label: t('cuisineOptions.asian') },
      { value: 'chinese', label: t('cuisineOptions.chinese') },
      { value: 'japanese', label: t('cuisineOptions.japanese') },
      { value: 'indian', label: t('cuisineOptions.indian') },
      { value: 'mediterranean', label: t('cuisineOptions.mediterranean') },
      { value: 'dutch', label: t('cuisineOptions.dutch') },
      { value: 'american', label: t('cuisineOptions.american') },
      { value: 'mexican', label: t('cuisineOptions.mexican') },
      { value: 'middle_eastern', label: t('cuisineOptions.middle_eastern') },
      { value: 'vegetarian', label: t('cuisineOptions.vegetarian') },
      { value: 'seafood', label: t('cuisineOptions.seafood') },
      { value: 'steakhouse', label: t('cuisineOptions.steakhouse') },
      { value: 'cafe', label: t('cuisineOptions.cafe') },
      { value: 'bakery', label: t('cuisineOptions.bakery') },
      { value: 'bar', label: t('cuisineOptions.bar') },
      { value: 'fine_dining', label: t('cuisineOptions.fine_dining') },
      { value: 'other', label: t('cuisineOptions.other') },
    ],
    [t]
  )

  const formatPostcode = (p: string): string => {
    if (!p) return ''
    const compact = p.replace(/\s+/g, '').toUpperCase()
    if (compact.length === 6) {
      return `${compact.slice(0, 4)} ${compact.slice(4)}`
    }
    return p
  }

  const fullStreetAddress = (a: LegalAddress): string => {
    const number = [a.houseNumber, a.houseLetter, a.houseNumberAddition]
      .filter((s) => s && s.length > 0)
      .join('')
    return [a.street, number].filter((s) => s.length > 0).join(' ')
  }

  // Helper for amber focus ring + border state
  const fieldBorder = (fieldName: string, error: string | null) => {
    if (error) return '1.5px solid #ef4444'
    if (focusedField === fieldName) return '1.5px solid var(--amber)'
    return '1.5px solid var(--cream-border)'
  }
  const fieldShadow = (fieldName: string, error: string | null) => {
    if (error) return 'none'
    if (focusedField === fieldName) return '0 0 0 3px rgba(212, 130, 10, 0.12)'
    return 'none'
  }

  const backHref = stepPath(0, locale)

  // ---- Common input style (base) ------------------------------------------
  const inputBase: React.CSSProperties = {
    width: '100%',
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--earth)',
    backgroundColor: 'var(--cream-card)',
    borderRadius: '14px',
    padding: '17px 18px 17px 56px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  }

  // ---- Hydration loading state -------------------------------------------
  if (hydrating) {
    return (
      <StepFrame
        locale={locale}
        showProgress={false}
        hideDefaultHeader
        currentStepDisplayNumber={1}
        totalSteps={totalSteps}
        heading={headingRaw}
        backHref={backHref}
        canContinue={false}
        continueLabel={t('continueLabel')}
        onContinue={() => {}}
        error={hydrationError}
      >
        <HeaderBand
          locale={locale}
          currentDisplayNum={1}
          totalSteps={totalSteps}
          headingBody={t('phase1.heading').replace(/\.$/, '')}
          sub={t('phase1.sub')}
        />
        <div style={{
          color: 'var(--stone)',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '14px',
        }}>
          {t('loading')}
        </div>
      </StepFrame>
    )
  }

  // ---- Main render --------------------------------------------------------
  return (
    <StepFrame
      locale={locale}
      showProgress={false}
      hideDefaultHeader
      currentStepDisplayNumber={1}
      totalSteps={totalSteps}
      heading={headingRaw}
      backHref={backHref}
      canContinue={canContinue}
      isSubmitting={isContinuing}
      continueLabel={t('continueLabel')}
      onContinue={handleContinue}
      error={null}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        .biz-plan-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
        }
        @media (max-width: 600px) {
          .biz-plan-grid {
            grid-template-columns: 1fr;
          }
        }
        .passport-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 26px 40px;
          position: relative;
        }
        @media (max-width: 500px) {
          .passport-grid {
            grid-template-columns: 1fr;
          }
        }
        .phone-email-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
        }
        @media (max-width: 560px) {
          .phone-email-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ── Header band ──────────────────────────────────────────────────── */}
      <HeaderBand
        locale={locale}
        currentDisplayNum={1}
        totalSteps={totalSteps}
        headingBody={headingBody}
        sub={sub}
        subIsLarge={inPhase2}
      />

      {!inPhase2 ? (
        // ─────────── Phase 1: KVK search ───────────
        <div ref={dropdownContainerRef} style={{ position: 'relative' }}>
          <FieldLabel htmlFor="kvk-search" text={t('phase1.searchLabel')} />

          <div style={{ position: 'relative' }}>
            {/* Amber icon tile — identity lookup */}
            <InputIconTile bg="var(--amber-bg)" color="var(--amber-deep)">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </InputIconTile>

            <input
              id="kvk-search"
              ref={searchInputRef}
              type="text"
              inputMode="text"
              autoComplete="off"
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-controls="kvk-search-dropdown"
              aria-autocomplete="list"
              aria-activedescendant={
                dropdownOpen && highlightIndex >= 0
                  ? `kvk-result-${highlightIndex}`
                  : undefined
              }
              value={query}
              placeholder={t('phase1.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setFocusedField('kvk-search')
                if (status === 'has-results') setDropdownOpen(true)
              }}
              onBlur={() => setFocusedField(null)}
              onKeyDown={handleSearchKeyDown}
              disabled={profileLoading}
              style={{
                ...inputBase,
                border: fieldBorder('kvk-search', null),
                boxShadow: fieldShadow('kvk-search', null),
              }}
            />
          </div>

          {helperLine && (
            <div style={{
              marginTop: '8px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              fontWeight: helperLine.variant === 'neutral' ? 400 : 500,
              color: helperLine.variant === 'error'
                ? '#dc2626'
                : helperLine.variant === 'nudge'
                  ? 'var(--amber)'
                  : 'var(--stone)',
            }}>
              {helperLine.text}
            </div>
          )}

          {dropdownOpen && results.length > 0 && (
            <div
              id="kvk-search-dropdown"
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                backgroundColor: 'var(--cream)',
                border: '1px solid rgba(156,139,106,0.3)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(30,21,8,0.12)',
                zIndex: 20,
                overflow: 'hidden',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              {results.map((r, i) => (
                <div
                  key={r.kvkNummer}
                  id={`kvk-result-${i}`}
                  role="option"
                  aria-selected={i === highlightIndex}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    color: 'var(--earth)',
                    borderBottom: '1px solid rgba(156,139,106,0.12)',
                    backgroundColor: i === highlightIndex ? 'rgba(212,130,10,0.10)' : 'transparent',
                  }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void handlePickResult(r)
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{r.handelsnaam}</div>
                  <div style={{ fontSize: '12px', color: 'var(--stone)', marginTop: '2px' }}>
                    KVK {r.kvkNummer}{r.plaats ? ` • ${r.plaats}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ─────────── Phase 2: Passport card + form ───────────
        <>
          {/* ── Verified passport card ───────────────────────────────────── */}
          <div style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '22px',
            padding: '34px 38px',
            marginBottom: '40px',
            background: `
              repeating-linear-gradient(48deg, rgba(212, 130, 10, 0.04) 0 2px, transparent 2px 11px),
              var(--earth)
            `,
            color: '#fbf6ec',
            boxShadow: '0 18px 44px rgba(30, 21, 8, 0.28)',
          }}>
            {/* Decorative seal watermark */}
            <svg
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-26px',
                bottom: '-30px',
                opacity: 0.10,
                transform: 'rotate(-12deg)',
                pointerEvents: 'none',
              }}
              width="200"
              height="200"
              viewBox="0 0 100 100"
              fill="none"
            >
              <circle cx="50" cy="50" r="46" stroke="#d4820a" strokeWidth="2" />
              <circle cx="50" cy="50" r="36" stroke="#d4820a" strokeWidth="1" strokeDasharray="3 3" />
              <path d="M38 50l8 8 18-18" stroke="#d4820a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Card header row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              position: 'relative',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              {/* KVK Verified pill */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                backgroundColor: 'var(--amber)',
                color: 'var(--earth)',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.13em',
                textTransform: 'uppercase' as const,
                padding: '9px 16px',
                borderRadius: '9999px',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('phase2.verifiedPill')}
              </span>

              {/* Change business */}
              <button
                type="button"
                onClick={handleChangeBusiness}
                onMouseEnter={() => setChangeHovered(true)}
                onMouseLeave={() => setChangeHovered(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  color: changeHovered ? 'var(--amber-hover)' : '#c8a05a',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                  transition: 'color 150ms ease',
                }}
              >
                {t('phase2.changeBusiness')}
              </button>
            </div>

            {/* Data grid */}
            <div className="passport-grid">
              <PassportField
                label={t('phase2.fields.legalName')}
                value={profile!.legalName}
              />
              {profile!.tradeName && profile!.tradeName !== profile!.legalName && (
                <PassportField
                  label={t('phase2.fields.tradeName')}
                  value={profile!.tradeName}
                />
              )}
              <PassportField
                label={t('phase2.fields.kvkNumber')}
                value={profile!.kvkNummer}
              />
              {profile!.legalForm && (
                <PassportField
                  label={t('phase2.fields.legalForm')}
                  value={profile!.legalForm}
                />
              )}
              {profile!.sbiCode && (
                <PassportField
                  label={t('phase2.fields.sbiCode')}
                  value={profile!.sbiCode}
                />
              )}
              <PassportField
                label={t('phase2.fields.address')}
                value={fullStreetAddress(profile!.legalAddress)}
              />
              <PassportField
                label={t('phase2.fields.postcode')}
                value={formatPostcode(profile!.legalAddress.postcode)}
              />
              <PassportField
                label={t('phase2.fields.city')}
                value={profile!.legalAddress.city}
              />
              {profile!.websiteUrl && (
                <PassportField
                  label={t('phase2.fields.website')}
                  value={profile!.websiteUrl}
                />
              )}
            </div>
          </div>

          {/* ── Editable form fields ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>

            {/* Display name */}
            <div>
              <FieldLabel htmlFor="field-display-name" text={t('phase2.form.displayNameLabel')} required />
              <div style={{ position: 'relative' }}>
                <InputIconTile bg="var(--amber-bg)" color="var(--amber-deep)">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 9l1.5-4h13L20 9M4 9v10h16V9M4 9h16M9 19v-5h6v5" />
                  </svg>
                </InputIconTile>
                <input
                  id="field-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => setFocusedField('displayName')}
                  onBlur={handleDisplayNameBlur}
                  maxLength={120}
                  placeholder={profile!.tradeName || profile!.legalName}
                  aria-invalid={!!displayNameError}
                  style={{ ...inputBase, border: fieldBorder('displayName', displayNameError), boxShadow: fieldShadow('displayName', displayNameError) }}
                />
              </div>
              {displayNameError ? (
                <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13px', color: '#dc2626' }}>
                  {displayNameError}
                </p>
              ) : (
                <p style={{ margin: '9px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13.5px', color: '#6f6353', lineHeight: 1.45 }}>
                  {t('phase2.form.displayNameHint')}
                </p>
              )}
            </div>

            {/* Phone + Email */}
            <div className="phone-email-grid">
              {/* Phone */}
              <div>
                <FieldLabel htmlFor="field-phone" text={t('phase2.form.phoneLabel')} />
                <div style={{ position: 'relative' }}>
                  <InputIconTile bg="var(--sage-bg)" color="var(--sage)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
                    </svg>
                  </InputIconTile>
                  <input
                    id="field-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={handlePhoneBlur}
                    placeholder={t('phase2.form.phonePlaceholder')}
                    aria-invalid={!!phoneError}
                    style={{ ...inputBase, border: fieldBorder('phone', phoneError), boxShadow: fieldShadow('phone', phoneError) }}
                  />
                </div>
                {phoneError && (
                  <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13px', color: '#dc2626' }}>
                    {phoneError}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <FieldLabel htmlFor="field-email" text={t('phase2.form.emailLabel')} />
                <div style={{ position: 'relative' }}>
                  <InputIconTile bg="var(--burgundy-bg)" color="var(--burgundy)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round">
                      <rect x="3" y="6" width="18" height="12" rx="1" />
                      <path d="M3 7l9 6 9-6" />
                    </svg>
                  </InputIconTile>
                  <input
                    id="field-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={handleEmailBlur}
                    placeholder={t('phase2.form.emailPlaceholder')}
                    aria-invalid={!!emailError}
                    style={{ ...inputBase, border: fieldBorder('email', emailError), boxShadow: fieldShadow('email', emailError) }}
                  />
                </div>
                {emailError && (
                  <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13px', color: '#dc2626' }}>
                    {emailError}
                  </p>
                )}
              </div>
            </div>

            {/* Cuisine type */}
            <div>
              <FieldLabel htmlFor="field-cuisine" text={t('phase2.form.cuisineLabel')} required />
              <div style={{ position: 'relative' }}>
                <InputIconTile bg="var(--sage-bg)" color="var(--sage)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3v8a2 2 0 004 0V3M7 11v10M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" />
                  </svg>
                </InputIconTile>
                {/* Right chevron */}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--stone)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: 'absolute',
                    right: '18px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <select
                  id="field-cuisine"
                  value={cuisine}
                  onChange={(e) => handleCuisineChange(e.target.value)}
                  onFocus={() => setFocusedField('cuisine')}
                  onBlur={handleCuisineBlur}
                  aria-invalid={!!cuisineError}
                  style={{
                    ...inputBase,
                    paddingRight: '44px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    border: fieldBorder('cuisine', cuisineError),
                    boxShadow: fieldShadow('cuisine', cuisineError),
                  } as React.CSSProperties}
                >
                  <option value="" disabled>{t('phase2.form.cuisinePlaceholder')}</option>
                  {cuisineOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {cuisineError && (
                <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13px', color: '#dc2626' }}>
                  {cuisineError}
                </p>
              )}
            </div>

            {/* Website */}
            <div>
              <FieldLabel htmlFor="field-website" text={t('phase2.form.websiteLabel')} />
              <div style={{ position: 'relative' }}>
                <InputIconTile bg="var(--amber-bg)" color="var(--amber-deep)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <path d="M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
                  </svg>
                </InputIconTile>
                <input
                  id="field-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  onFocus={() => setFocusedField('website')}
                  onBlur={handleWebsiteBlur}
                  placeholder={t('phase2.form.websitePlaceholder')}
                  aria-invalid={!!websiteError}
                  style={{ ...inputBase, border: fieldBorder('website', websiteError), boxShadow: fieldShadow('website', websiteError) }}
                />
              </div>
              {websiteError && (
                <p style={{ margin: '7px 0 0', fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '13px', color: '#dc2626' }}>
                  {websiteError}
                </p>
              )}
            </div>

          </div>
        </>
      )}
    </StepFrame>
  )
}

// ---- HeaderBand (shared between loading + main render) ----------------------

function HeaderBand({
  locale,
  currentDisplayNum,
  totalSteps,
  headingBody,
  sub,
  subIsLarge = false,
}: {
  locale: 'nl' | 'en'
  currentDisplayNum: number
  totalSteps: number
  headingBody: string
  sub: string
  subIsLarge?: boolean
}) {
  const stepPillText = locale === 'en'
    ? `Step ${currentDisplayNum} of ${totalSteps} — Identity`
    : `Stap ${currentDisplayNum} van ${totalSteps} — Identiteit`

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '44px',
      gap: '16px',
    }}>
      {/* Left */}
      <div>
        {/* Step pill */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          backgroundColor: 'var(--earth)',
          color: 'var(--amber)',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '9.5px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          borderRadius: '9999px',
          marginBottom: '14px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '9999px', backgroundColor: 'var(--amber)', flexShrink: 0 }} />
          {stepPillText}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: '42px',
          lineHeight: 0.96,
          letterSpacing: '-0.035em',
          color: 'var(--earth)',
          margin: '0 0 14px 0',
        }}>
          {headingBody}<span style={{ color: 'var(--amber)' }}>.</span>
        </h1>

        {/* Description */}
        <p style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: subIsLarge ? '16px' : '13px',
          lineHeight: 1.55,
          color: '#6f6353',
          maxWidth: '520px',
          margin: 0,
        }}>
          {sub}
        </p>
      </div>

      {/* Right: step counter + progress dots */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: '32px',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: 'var(--earth)',
        }}>
          {String(currentDisplayNum).padStart(2, '0')}
          <span style={{ fontSize: '17px', color: 'var(--stone-dim)', letterSpacing: '-0.01em' }}>
            /{String(totalSteps).padStart(2, '0')}
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: '3px',
          justifyContent: 'flex-end',
          marginTop: '10px',
        }}>
          {Array.from({ length: totalSteps }, (_, i) => {
            const n = i + 1
            const isCurrent = n === currentDisplayNum
            const isDone = n < currentDisplayNum
            return (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  backgroundColor: isCurrent
                    ? 'var(--sage)'
                    : isDone
                      ? 'var(--amber)'
                      : 'var(--cream-border)',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---- PassportField (data row inside the dark passport card) -----------------

function PassportField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.13em',
        textTransform: 'uppercase' as const,
        color: '#a88e5c',
        marginBottom: '7px',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '19px',
        fontWeight: 600,
        color: '#f4ead6',
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>
        {value || '—'}
      </div>
    </div>
  )
}

// ---- SavedIndicator ---------------------------------------------------------

function SavedIndicator({
  state,
  locale,
}: {
  state: DraftSaveState
  locale: 'nl' | 'en'
}) {
  if (state.status === 'idle') return null

  const labels =
    locale === 'en'
      ? { saving: 'Saving…', saved: 'Saved', error: 'Save failed', retry: 'Retry' }
      : { saving: 'Opslaan…', saved: 'Opgeslagen', error: 'Opslaan mislukt', retry: 'Opnieuw' }

  const baseStyle: React.CSSProperties = {
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  if (state.status === 'saving') {
    return <span style={{ ...baseStyle, color: 'var(--stone)' }}>{labels.saving}</span>
  }

  if (state.status === 'saved') {
    return (
      <span style={{ ...baseStyle, color: '#16a34a' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {labels.saved}
      </span>
    )
  }

  if (state.status === 'error') {
    return (
      <span style={{ ...baseStyle, color: '#dc2626' }}>
        {labels.error}
        <button
          type="button"
          onClick={state.retry}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: '#dc2626',
            textDecoration: 'underline',
          }}
        >
          {labels.retry}
        </button>
      </span>
    )
  }

  return null
}
