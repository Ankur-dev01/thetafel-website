'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import {
  getVisibleSteps,
  getTotalWizardSteps,
} from '@/lib/onboarding/steps'
import { stepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'
import type { DraftSaveState } from '@/lib/onboarding/useDraftSave'
import TextField from '@/components/onboarding/fields/TextField'
import SelectField from '@/components/onboarding/fields/SelectField'
import type { SelectOption } from '@/components/onboarding/fields/SelectField'

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

// Client-side minimum query length. Server accepts from 1 char but
// dropdown noise from 1-2 char queries is unhelpful.
const CLIENT_MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 400

const SBI_RESTAURANT_RE = /^56/

function sbiEligible(sbi: string): boolean {
  return SBI_RESTAURANT_RE.test(sbi.trim())
}

// DEV ONLY — must be unset/false in production. Bypasses SBI restaurant-eligibility guard.
const DEV_BYPASS_SBI = process.env.NEXT_PUBLIC_DEV_BYPASS_SBI === 'true'

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

// ---- Component --------------------------------------------------------------

export default function BusinessVerificationPage() {
  const t = useTranslations('onboarding.business')
  const params = useParams()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
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

  // Inline validation errors
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [cuisineError, setCuisineError] = useState<string | null>(null)
  const [websiteError, setWebsiteError] = useState<string | null>(null)

  const [isContinuing, setIsContinuing] = useState(false)

  // Refs ---------------------------------------------------------------------
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

        // Defensive parser — accept multiple plausible shapes
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

          // If KVK was already verified, hydrate directly into Phase 2
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
            // Restore form values from draft — draft values win over profile defaults
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
  }, [t])

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
  // Defined before handleSearchKeyDown so it can be included in its deps.
  // Uses a direct fetch for the KVK PATCH (not useDraftSave) so we can
  // detect 409 (KVK already linked to another account) from the HTTP status.
  const handlePickResult = useCallback(
    async (result: SearchResult) => {
      setDropdownOpen(false)
      setProfileLoading(true)
      setCardError(null)
      try {
        // 1. Fetch KVK profile
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

        // 2. Persist KVK fields to draft immediately.
        //    Direct fetch so we can read the raw HTTP status for 409.
        //    kvk_verified_at is intentionally omitted — not in restaurantPatchSchema.
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

        // 3. Enter Phase 2 and initialize form from KVK data
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

        // Clear search state
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

  // ---- Per-field blur handlers (validate + saveNow on blur) ---------------

  const handleDisplayNameBlur = useCallback(() => {
    if (!displayName.trim()) {
      setDisplayNameError(t('errors.displayNameRequired'))
      return
    }
    setDisplayNameError(null)
    void saveNow({ restaurant: { display_name: displayName.trim() } })
  }, [displayName, saveNow, t])

  const handlePhoneBlur = useCallback(() => {
    if (phone.trim() && !isValidDutchPhone(phone)) {
      setPhoneError(t('errors.phoneInvalid'))
      return
    }
    setPhoneError(null)
    // contact_phone accepts empty string — always save on blur
    void saveNow({ restaurant: { contact_phone: phone.trim() } })
  }, [phone, saveNow, t])

  const handleEmailBlur = useCallback(() => {
    if (email.trim() && !isValidEmail(email)) {
      setEmailError(t('errors.emailInvalid'))
      return
    }
    setEmailError(null)
    // contact_email requires valid email — only save if non-empty
    if (email.trim()) {
      void saveNow({ restaurant: { contact_email: email.trim() } })
    }
  }, [email, saveNow, t])

  const handleCuisineChange = useCallback((val: string) => {
    setCuisine(val)
    if (val) setCuisineError(null)
  }, [])

  const handleCuisineBlur = useCallback(() => {
    if (!cuisine) {
      setCuisineError(t('errors.cuisineRequired'))
      return
    }
    setCuisineError(null)
    void saveNow({ restaurant: { cuisine_type: cuisine } })
  }, [cuisine, saveNow, t])

  const handleWebsiteBlur = useCallback(() => {
    const normalized = normalizeWebsite(website)
    setWebsite(normalized)
    if (normalized && !isValidWebsite(normalized)) {
      setWebsiteError(t('errors.websiteInvalid'))
      return
    }
    setWebsiteError(null)
    // website requires valid URL — only save if non-empty
    if (normalized) {
      void saveNow({ restaurant: { website: normalized } })
    }
  }, [website, saveNow, t])

  // ---- Continue handler ---------------------------------------------------
  const handleContinue = useCallback(async () => {
    if (!profile) return
    if (!DEV_BYPASS_SBI && !sbiEligible(profile.sbiCode)) return
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
      // saveNow already surfaces error via saveState; Continue button re-enables
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
  // hasSbiError is false when DEV_BYPASS_SBI is on, suppressing the banner and
  // enabling Continue. The pill is driven by sbiEligible() directly so it always
  // shows the honest state regardless of the override.
  const hasSbiError = !DEV_BYPASS_SBI && profile !== null && !sbiEligible(profile.sbiCode)

  const canContinue =
    inPhase2 &&
    !hasSbiError &&
    displayName.trim().length > 0 &&
    cuisine.length > 0 &&
    !displayNameError &&
    !phoneError &&
    !emailError &&
    !cuisineError &&
    !websiteError &&
    !isContinuing

  const heading = inPhase2 ? t('phase2.heading') : t('phase1.heading')
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

  const cuisineOptions: SelectOption[] = useMemo(
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

  const backHref = stepPath(0, locale)

  // ---- Styles (inline — per handoff Lesson 3) -----------------------------

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '720px',
    margin: '0 auto',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
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
    backgroundColor: 'var(--warm)',
    border: '1px solid rgba(156,139,106,0.25)',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const helperNeutralStyle: React.CSSProperties = {
    marginTop: '8px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '13px',
    fontWeight: 400,
    color: 'var(--stone)',
  }

  const helperNudgeStyle: React.CSSProperties = {
    ...helperNeutralStyle,
    color: 'var(--amber)',
    fontWeight: 500,
  }

  const helperErrorStyle: React.CSSProperties = {
    ...helperNeutralStyle,
    color: '#dc2626',
    fontWeight: 500,
  }

  const dropdownStyle: React.CSSProperties = {
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
  }

  const dropdownItemBaseStyle: React.CSSProperties = {
    padding: '12px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    color: 'var(--earth)',
    borderBottom: '1px solid rgba(156,139,106,0.12)',
    backgroundColor: 'transparent',
  }

  const dropdownItemHighlightStyle: React.CSSProperties = {
    ...dropdownItemBaseStyle,
    backgroundColor: 'rgba(212,130,10,0.10)',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--warm)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(156,139,106,0.2)',
  }

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '12px',
    flexWrap: 'wrap',
  }

  const verifiedPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(212,130,10,0.15)',
    color: 'var(--amber)',
    borderRadius: '999px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }

  // Neutral pill for SBI-ineligible businesses (found in KVK but not a restaurant).
  // Shown regardless of DEV_BYPASS_SBI so the UI is always honest about SBI state.
  const foundPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: 'rgba(156,139,106,0.12)',
    color: 'var(--stone)',
    borderRadius: '999px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  }

  const changeBusinessLinkStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--stone)',
    textDecoration: 'underline',
  }

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  }

  const sbiBannerStyle: React.CSSProperties = {
    padding: '14px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '12px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    color: '#dc2626',
    lineHeight: 1.5,
  }

  const formSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  }

  const phoneEmailGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  }

  // ---- Hydration loading state --------------------------------------------
  if (hydrating) {
    return (
      <StepFrame
        locale={locale}
        currentStepDisplayNumber={1}
        totalSteps={totalSteps}
        serviceTag={t('serviceTag')}
        heading={t('phase1.heading')}
        subHeading={t('phase1.sub')}
        backHref={backHref}
        canContinue={false}
        continueLabel={t('continueLabel')}
        onContinue={() => {}}
        error={hydrationError}
      >
        <div
          style={{
            ...containerStyle,
            color: 'var(--stone)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
          }}
        >
          {t('loading')}
        </div>
      </StepFrame>
    )
  }

  // ---- Render -------------------------------------------------------------
  return (
    <StepFrame
      locale={locale}
      currentStepDisplayNumber={1}
      totalSteps={totalSteps}
      serviceTag={t('serviceTag')}
      heading={heading}
      subHeading={sub}
      backHref={backHref}
      canContinue={canContinue}
      isSubmitting={isContinuing}
      continueLabel={t('continueLabel')}
      onContinue={handleContinue}
      error={null}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <div style={containerStyle}>
        {!inPhase2 ? (
          // ─────────── Phase 1: Search ───────────
          <div ref={dropdownContainerRef} style={{ position: 'relative' }}>
            <label style={labelStyle} htmlFor="kvk-search">
              {t('phase1.searchLabel')}
            </label>
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
                if (status === 'has-results') setDropdownOpen(true)
              }}
              onKeyDown={handleSearchKeyDown}
              disabled={profileLoading}
              style={inputStyle}
            />

            {helperLine && (
              <div
                style={
                  helperLine.variant === 'nudge'
                    ? helperNudgeStyle
                    : helperLine.variant === 'error'
                      ? helperErrorStyle
                      : helperNeutralStyle
                }
              >
                {helperLine.text}
              </div>
            )}

            {dropdownOpen && results.length > 0 && (
              <div
                id="kvk-search-dropdown"
                role="listbox"
                style={dropdownStyle}
              >
                {results.map((r, i) => (
                  <div
                    key={r.kvkNummer}
                    id={`kvk-result-${i}`}
                    role="option"
                    aria-selected={i === highlightIndex}
                    style={
                      i === highlightIndex
                        ? dropdownItemHighlightStyle
                        : dropdownItemBaseStyle
                    }
                    onMouseEnter={() => setHighlightIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      void handlePickResult(r)
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.handelsnaam}</div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--stone)',
                        marginTop: '2px',
                      }}
                    >
                      KVK {r.kvkNummer}
                      {r.plaats ? ` • ${r.plaats}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // ─────────── Phase 2: Identity card + form ───────────
          <>
            {/* KVK identity card */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                {sbiEligible(profile!.sbiCode) ? (
                  <span style={verifiedPillStyle}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {t('phase2.verifiedPill')}
                  </span>
                ) : (
                  <span style={foundPillStyle}>
                    {t('phase2.kvkFoundPill')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleChangeBusiness}
                  style={changeBusinessLinkStyle}
                >
                  {t('phase2.changeBusiness')}
                </button>
              </div>

              <div style={cardGridStyle}>
                <CardField
                  label={t('phase2.fields.legalName')}
                  value={profile!.legalName}
                />
                {profile!.tradeName &&
                  profile!.tradeName !== profile!.legalName && (
                    <CardField
                      label={t('phase2.fields.tradeName')}
                      value={profile!.tradeName}
                    />
                  )}
                <CardField
                  label={t('phase2.fields.kvkNumber')}
                  value={profile!.kvkNummer}
                />
                {profile!.legalForm && (
                  <CardField
                    label={t('phase2.fields.legalForm')}
                    value={profile!.legalForm}
                  />
                )}
                {profile!.sbiCode && (
                  <CardField
                    label={t('phase2.fields.sbiCode')}
                    value={profile!.sbiCode}
                  />
                )}
                <CardField
                  label={t('phase2.fields.address')}
                  value={fullStreetAddress(profile!.legalAddress)}
                />
                <CardField
                  label={t('phase2.fields.postcode')}
                  value={formatPostcode(profile!.legalAddress.postcode)}
                />
                <CardField
                  label={t('phase2.fields.city')}
                  value={profile!.legalAddress.city}
                />
                {profile!.websiteUrl && (
                  <CardField
                    label={t('phase2.fields.website')}
                    value={profile!.websiteUrl}
                  />
                )}
              </div>
            </div>

            {/* SBI guard — shown when SBI code is not 56.x */}
            {hasSbiError && (
              <div style={sbiBannerStyle}>
                {t('phase2.sbiError')}
              </div>
            )}

            {/* Editable public details form */}
            <div style={formSectionStyle}>
              <TextField
                label={t('phase2.form.displayNameLabel')}
                hint={t('phase2.form.displayNameHint')}
                value={displayName}
                onChange={setDisplayName}
                onBlur={handleDisplayNameBlur}
                error={displayNameError ?? undefined}
                required
                maxLength={120}
                placeholder={profile!.tradeName || profile!.legalName}
              />

              <div style={phoneEmailGridStyle}>
                <TextField
                  label={t('phase2.form.phoneLabel')}
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  onBlur={handlePhoneBlur}
                  error={phoneError ?? undefined}
                  placeholder={t('phase2.form.phonePlaceholder')}
                />
                <TextField
                  label={t('phase2.form.emailLabel')}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  onBlur={handleEmailBlur}
                  error={emailError ?? undefined}
                  placeholder={t('phase2.form.emailPlaceholder')}
                />
              </div>

              <SelectField
                label={t('phase2.form.cuisineLabel')}
                value={cuisine}
                onChange={handleCuisineChange}
                onBlur={handleCuisineBlur}
                options={cuisineOptions}
                placeholder={t('phase2.form.cuisinePlaceholder')}
                error={cuisineError ?? undefined}
                required
              />

              <TextField
                label={t('phase2.form.websiteLabel')}
                type="url"
                value={website}
                onChange={setWebsite}
                onBlur={handleWebsiteBlur}
                error={websiteError ?? undefined}
                placeholder={t('phase2.form.websitePlaceholder')}
              />
            </div>
          </>
        )}
      </div>
    </StepFrame>
  )
}

// ---- CardField sub-component ------------------------------------------------

function CardField({ label, value }: { label: string; value: string }) {
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--stone)',
    marginBottom: '4px',
  }
  const valueStyle: React.CSSProperties = {
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--earth)',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  }
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value || '—'}</div>
    </div>
  )
}

// ---- SavedIndicator sub-component ------------------------------------------

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
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  if (state.status === 'saving') {
    return (
      <span style={{ ...baseStyle, color: 'var(--stone)' }}>
        {labels.saving}
      </span>
    )
  }

  if (state.status === 'saved') {
    return (
      <span style={{ ...baseStyle, color: '#16a34a' }}>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
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
            fontFamily: 'var(--font-jost), sans-serif',
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
