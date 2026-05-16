// app/[locale]/onboarding/step/2/page.tsx
//
// Onboarding Step 2 — Dining Venue Address.
//
// Per the Phase C plan: this collects the address where diners actually
// go to eat. Many restaurants are registered (KVK) at the owner's home or
// accountant's office, so the dining venue address may differ from the
// legal/business address captured in Step 1.
//
// Flow:
//   1. On mount, GET /api/v1/restaurants/draft to read the KVK legal
//      address saved in Step 1.
//   2. Show a read-only summary of that legal address.
//   3. Toggle "Is je restaurant op een ander adres?" — default OFF.
//        OFF → venue address = legal address (copied on Continue).
//        ON  → editable venue form with PDOK postcode autofill.
//   4. On Continue, write address / postcode / city to the draft and
//      navigate to Step 3.
//
// PDOK autofill: when postcode is a valid format AND a house number is
// present, a debounced call to /api/pdok/lookup fills street + city.
// Every field stays editable after autofill.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import StepLayout from '@/components/onboarding/StepLayout'
import { saveDraft } from '@/lib/restaurants/draft'

// ---- Types ----------------------------------------------------------------

type DraftRestaurant = {
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
  address: string | null
  postcode: string | null
  city: string | null
}

type VenueForm = {
  postcode: string
  houseNumber: string
  street: string
  city: string
}

// ---- i18n copy ------------------------------------------------------------

const COPY = {
  nl: {
    eyebrow: 'Stap 2 van 6 — Locatie',
    heading: 'Waar is je restaurant?',
    sub: 'Dit is het adres waar gasten naartoe komen om te eten.',
    loading: 'Laden...',
    legalAddressTitle: 'Je bedrijf is geregistreerd op',
    noLegalAddress:
      'We konden geen bedrijfsadres vinden. Vul hieronder het adres van je restaurant in.',
    toggleLabel: 'Is je restaurant op een ander adres dan je bedrijfsadres?',
    toggleHelp:
      'Veel restaurants zijn ingeschreven op een thuisadres of het adres van de boekhouder. Zet dit aan als je restaurant ergens anders zit.',
    postcodeLabel: 'Postcode',
    houseNumberLabel: 'Huisnummer',
    streetLabel: 'Straatnaam',
    cityLabel: 'Plaats',
    postcodeError: 'Postcode moet het formaat 1234 AB hebben.',
    pdokSearching: 'Adres zoeken...',
    pdokNotFound:
      'Adres niet gevonden. Vul de straatnaam en plaats handmatig in.',
    continueLabel: 'Doorgaan',
    submittingLabel: 'Opslaan...',
    saveErrorGeneric: 'Opslaan mislukt. Probeer het opnieuw.',
  },
  en: {
    eyebrow: 'Step 2 of 6 — Location',
    heading: 'Where is your restaurant?',
    sub: 'This is the address where guests come to dine.',
    loading: 'Loading...',
    legalAddressTitle: 'Your business is registered at',
    noLegalAddress:
      'We could not find a business address. Enter your restaurant address below.',
    toggleLabel: 'Is your restaurant at a different address than your business address?',
    toggleHelp:
      'Many restaurants are registered at a home address or their accountant address. Turn this on if your restaurant is somewhere else.',
    postcodeLabel: 'Postcode',
    houseNumberLabel: 'House number',
    streetLabel: 'Street',
    cityLabel: 'City',
    postcodeError: 'Postcode must be in format 1234 AB.',
    pdokSearching: 'Looking up address...',
    pdokNotFound:
      'Address not found. Please enter the street and city manually.',
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

const fieldErrorStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  color: '#dc2626',
}

const fieldHintStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 400,
  color: 'var(--stone)',
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

// Build a single-line address string from KVK legal address parts.
// e.g. "Hizzaarderlaan 3A bis"
function buildLegalAddressLine(d: DraftRestaurant): string {
  const parts: string[] = []
  if (d.legal_address_street) parts.push(d.legal_address_street)
  const numberBits = [
    d.legal_address_house_number ?? '',
    d.legal_address_house_letter ?? '',
  ]
    .join('')
    .trim()
  if (numberBits) parts.push(numberBits)
  if (d.legal_address_house_number_addition) {
    parts.push(d.legal_address_house_number_addition)
  }
  return parts.join(' ').trim()
}

// Build the `address` column value (street + house number) from venue form.
function buildVenueAddressLine(f: VenueForm): string {
  return [f.street.trim(), f.houseNumber.trim()].filter(Boolean).join(' ')
}

// ---- Component ------------------------------------------------------------

export default function OnboardingStep2Page() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''
  const t = COPY[locale]

  // Load state
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<DraftRestaurant | null>(null)

  // Toggle: false = use business address, true = different address
  const [differentAddress, setDifferentAddress] = useState(false)

  // Venue form (only used when differentAddress is true)
  const [form, setForm] = useState<VenueForm>({
    postcode: '',
    houseNumber: '',
    street: '',
    city: '',
  })

  // Validation / PDOK / save state
  const [postcodeError, setPostcodeError] = useState<string | null>(null)
  const [pdokStatus, setPdokStatus] = useState<
    'idle' | 'searching' | 'not-found'
  >('idle')
  const [cardError, setCardError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pdokTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pdokAbortRef = useRef<AbortController | null>(null)

  // ---- Load existing draft on mount -------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setLoading(false)
          return
        }
        const data = (await res.json()) as {
          restaurant: DraftRestaurant | null
        }
        if (cancelled) return

        const r = data.restaurant
        setDraft(r)

        if (r) {
          const hasLegalAddress =
            !!r.legal_address_street && !!r.legal_address_postcode

          // If the venue address columns are already populated AND differ
          // from the legal address, pre-set the toggle ON and fill the form.
          const legalLine = buildLegalAddressLine(r)
          const venueDiffers =
            !!r.address &&
            (r.address !== legalLine ||
              normalisePostcode(r.postcode ?? '') !==
                normalisePostcode(r.legal_address_postcode ?? ''))

          if (venueDiffers) {
            setDifferentAddress(true)
            setForm({
              postcode: formatPostcodeForDisplay(r.postcode ?? ''),
              houseNumber: r.legal_address_house_number ?? '',
              street: r.address ?? '',
              city: r.city ?? '',
            })
          } else if (!hasLegalAddress) {
            // No legal address at all — force the manual form open.
            setDifferentAddress(true)
            setForm({
              postcode: formatPostcodeForDisplay(r.postcode ?? ''),
              houseNumber: '',
              street: r.address ?? '',
              city: r.city ?? '',
            })
          }
        }

        setLoading(false)
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- PDOK autofill -----------------------------------------------------
  // Triggered when postcode is a valid format AND a house number is present.
  useEffect(() => {
    if (!differentAddress) return

    if (pdokTimerRef.current) clearTimeout(pdokTimerRef.current)

    const postcodeClean = normalisePostcode(form.postcode)
    const houseNumber = form.houseNumber.trim()

    if (!/^\d{4}[A-Z]{2}$/.test(postcodeClean) || houseNumber.length === 0) {
      setPdokStatus('idle')
      return
    }

    pdokTimerRef.current = setTimeout(async () => {
      if (pdokAbortRef.current) pdokAbortRef.current.abort()
      const controller = new AbortController()
      pdokAbortRef.current = controller
      setPdokStatus('searching')

      try {
        const res = await fetch(
          `/api/pdok/lookup?postcode=${encodeURIComponent(
            postcodeClean
          )}&huisnummer=${encodeURIComponent(houseNumber)}`,
          { signal: controller.signal, cache: 'no-store' }
        )
        const data = (await res.json()) as
          | { ok: true; address: { street: string; city: string } }
          | { ok: false; error: string }

        if (data.ok) {
          setForm((prev) => ({
            ...prev,
            street: data.address.street || prev.street,
            city: data.address.city || prev.city,
          }))
          setPdokStatus('idle')
        } else {
          setPdokStatus('not-found')
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return
        setPdokStatus('not-found')
      }
    }, 500)

    return () => {
      if (pdokTimerRef.current) clearTimeout(pdokTimerRef.current)
    }
  }, [form.postcode, form.houseNumber, differentAddress])

  // ---- Form helpers ------------------------------------------------------
  const updateForm = useCallback(
    <K extends keyof VenueForm>(key: K, value: VenueForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

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

  // ---- Continue enable logic --------------------------------------------
  const hasLegalAddress =
    !!draft?.legal_address_street && !!draft?.legal_address_postcode

  const canContinue = (() => {
    if (loading || submitting) return false
    if (!differentAddress) {
      // Using business address — only valid if a legal address exists.
      return hasLegalAddress
    }
    // Different address — venue form must be complete & valid.
    if (postcodeError) return false
    if (!POSTCODE_REGEX.test(form.postcode.trim())) return false
    if (form.houseNumber.trim().length === 0) return false
    if (form.street.trim().length === 0) return false
    if (form.city.trim().length === 0) return false
    return true
  })()

  // ---- Continue handler --------------------------------------------------
  const handleContinue = useCallback(async () => {
    setSubmitting(true)
    setCardError(null)

    let addressValue: string
    let postcodeValue: string
    let cityValue: string

    if (!differentAddress && draft) {
      // Copy the KVK legal address into the venue columns.
      addressValue = buildLegalAddressLine(draft)
      postcodeValue = normalisePostcode(draft.legal_address_postcode ?? '')
      cityValue = draft.legal_address_city ?? ''
    } else {
      // Use the manually entered venue address.
      addressValue = buildVenueAddressLine(form)
      postcodeValue = normalisePostcode(form.postcode)
      cityValue = form.city.trim()
    }

    const writes: { field: string; value: string | null }[] = [
      { field: 'address', value: addressValue || null },
      { field: 'postcode', value: postcodeValue || null },
      { field: 'city', value: cityValue || null },
    ]

    for (const w of writes) {
      const res = await saveDraft(w.field, w.value)
      if (!res.ok) {
        setCardError(res.error || t.saveErrorGeneric)
        setSubmitting(false)
        return
      }
    }

    router.push(`${localePrefix}/onboarding/step/3`)
  }, [differentAddress, draft, form, router, localePrefix, t.saveErrorGeneric])

  // ---- Render ------------------------------------------------------------

  const legalAddressLine = draft ? buildLegalAddressLine(draft) : ''
  const legalPostcodeCity = draft
    ? [
        formatPostcodeForDisplay(draft.legal_address_postcode ?? ''),
        draft.legal_address_city ?? '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  return (
    <StepLayout
      currentStep={2}
      totalSteps={6}
      eyebrow={t.eyebrow}
      heading={t.heading}
      sub={t.sub}
      backHref={`${localePrefix}/onboarding`}
      continueLabel={t.continueLabel}
      submittingLabel={t.submittingLabel}
      canContinue={canContinue}
      isSubmitting={submitting}
      onContinue={handleContinue}
      error={cardError}
    >
      {loading ? (
        <div
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
            color: 'var(--stone)',
          }}
        >
          {t.loading}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Legal address summary */}
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
              {t.legalAddressTitle}
            </div>
            {hasLegalAddress ? (
              <>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--earth)',
                  }}
                >
                  {legalAddressLine}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '13px',
                    fontWeight: 400,
                    color: 'var(--stone)',
                    marginTop: '2px',
                  }}
                >
                  {legalPostcodeCity}
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'var(--stone)',
                }}
              >
                {t.noLegalAddress}
              </div>
            )}
          </div>

          {/* Toggle — only shown when a legal address exists */}
          {hasLegalAddress && (
            <div>
              <button
                type="button"
                onClick={() => setDifferentAddress((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '14px 16px',
                  backgroundColor: 'var(--cream)',
                  border: '1px solid rgba(156,139,106,0.25)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {/* Switch track */}
                <span
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    width: '40px',
                    height: '22px',
                    borderRadius: '999px',
                    backgroundColor: differentAddress
                      ? 'var(--amber)'
                      : 'rgba(156,139,106,0.35)',
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  {/* Switch knob */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: differentAddress ? '20px' : '2px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      transition: 'left 0.2s ease',
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--earth)',
                  }}
                >
                  {t.toggleLabel}
                </span>
              </button>
              <div style={fieldHintStyle}>{t.toggleHelp}</div>
            </div>
          )}

          {/* Venue address form */}
          {differentAddress && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Postcode + house number */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr',
                  gap: '12px',
                }}
              >
                <div>
                  <label style={labelStyle} htmlFor="venue-postcode">
                    {t.postcodeLabel}
                  </label>
                  <input
                    id="venue-postcode"
                    type="text"
                    autoComplete="off"
                    value={form.postcode}
                    onChange={(e) => handlePostcodeChange(e.target.value)}
                    style={postcodeError ? inputErrorStyle : inputStyle}
                    maxLength={7}
                    placeholder="1234 AB"
                  />
                  {postcodeError && (
                    <div style={fieldErrorStyle}>{postcodeError}</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle} htmlFor="venue-housenumber">
                    {t.houseNumberLabel}
                  </label>
                  <input
                    id="venue-housenumber"
                    type="text"
                    autoComplete="off"
                    value={form.houseNumber}
                    onChange={(e) =>
                      updateForm('houseNumber', e.target.value)
                    }
                    style={inputStyle}
                    maxLength={20}
                    placeholder="12"
                  />
                </div>
              </div>

              {/* PDOK status line */}
              {pdokStatus === 'searching' && (
                <div style={fieldHintStyle}>{t.pdokSearching}</div>
              )}
              {pdokStatus === 'not-found' && (
                <div style={fieldErrorStyle}>{t.pdokNotFound}</div>
              )}

              {/* Street */}
              <div>
                <label style={labelStyle} htmlFor="venue-street">
                  {t.streetLabel}
                </label>
                <input
                  id="venue-street"
                  type="text"
                  autoComplete="off"
                  value={form.street}
                  onChange={(e) => updateForm('street', e.target.value)}
                  style={inputStyle}
                  maxLength={120}
                />
              </div>

              {/* City */}
              <div>
                <label style={labelStyle} htmlFor="venue-city">
                  {t.cityLabel}
                </label>
                <input
                  id="venue-city"
                  type="text"
                  autoComplete="off"
                  value={form.city}
                  onChange={(e) => updateForm('city', e.target.value)}
                  style={inputStyle}
                  maxLength={100}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </StepLayout>
  )
}
