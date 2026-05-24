// app/[locale]/onboarding/step/3/page.tsx
//
// Onboarding Step 3 — Cuisine, Photo, Vibe.
//
// Per Phase 1 PRD §6.2 and §C.2:
//   - Cuisine type: select from a fixed list. Required.
//   - Hero photo: drag-and-drop or click to choose. Required.
//   - Description ("vibe"): short free text. Optional.
//
// On mount, GET /api/v1/restaurants/draft to pre-fill any values the
// owner already set (so returning to this step shows their data).
//
// Cuisine and description auto-save via saveDraft() on Continue.
// The photo uploads immediately on selection via POST /api/v1/restaurants/photo
// (that route stores the file and writes hero_image_url itself).

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import StepLayout from '@/components/onboarding/StepLayout'
import { saveDraft } from '@/lib/restaurants/draft'

// ---- Types ----------------------------------------------------------------

type DraftRestaurant = {
  cuisine_type: string | null
  description: string | null
  hero_image_url: string | null
}

// ---- Cuisine options (from PRD §C.2) --------------------------------------
// Fixed list. Stored as the plain value string.

const CUISINE_OPTIONS = [
  'Nederlands',
  'Italiaans',
  'Aziatisch',
  'Mediterraan',
  'Burgers',
  'Steakhouse',
  'Seafood',
  'Vegetarisch',
  'Anders',
] as const

// ---- i18n copy ------------------------------------------------------------

const COPY = {
  nl: {
    eyebrow: 'Stap 3 van 6 — Sfeer',
    heading: 'Vertel over je restaurant.',
    sub: 'Kies je keuken, voeg een foto toe en beschrijf de sfeer.',
    loading: 'Laden...',
    cuisineLabel: 'Soort keuken',
    cuisinePlaceholder: 'Kies een keuken',
    photoLabel: 'Foto van je restaurant',
    photoInstruction: 'Sleep je foto hierheen of klik om te kiezen.',
    photoHint: 'JPG of WebP, maximaal 5MB.',
    photoUploading: 'Foto uploaden...',
    photoChange: 'Andere foto kiezen',
    descriptionLabel: 'Beschrijving (optioneel)',
    descriptionPlaceholder:
      'Bijv. Een warm en gezellig familierestaurant in het hart van de stad.',
    continueLabel: 'Doorgaan',
    submittingLabel: 'Opslaan...',
    errorWrongType: 'Alleen JPG- en WebP-foto’s worden geaccepteerd.',
    errorTooLarge: 'De foto moet kleiner zijn dan 5MB.',
    errorUploadFailed: 'Uploaden mislukt. Probeer het opnieuw.',
    saveErrorGeneric: 'Opslaan mislukt. Probeer het opnieuw.',
  },
  en: {
    eyebrow: 'Step 3 of 6 — Vibe',
    heading: 'Tell us about your restaurant.',
    sub: 'Pick your cuisine, add a photo, and describe the atmosphere.',
    loading: 'Loading...',
    cuisineLabel: 'Cuisine type',
    cuisinePlaceholder: 'Choose a cuisine',
    photoLabel: 'Photo of your restaurant',
    photoInstruction: 'Drag your photo here or click to choose.',
    photoHint: 'JPG or WebP, max 5MB.',
    photoUploading: 'Uploading photo...',
    photoChange: 'Choose a different photo',
    descriptionLabel: 'Description (optional)',
    descriptionPlaceholder:
      'e.g. A warm and cosy family restaurant in the heart of the city.',
    continueLabel: 'Continue',
    submittingLabel: 'Saving...',
    errorWrongType: 'Only JPG and WebP photos are accepted.',
    errorTooLarge: 'The photo must be smaller than 5MB.',
    errorUploadFailed: 'Upload failed. Please try again.',
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

const hintStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 400,
  color: 'var(--stone)',
}

const errorTextStyle: React.CSSProperties = {
  marginTop: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  color: '#ef4444',
}

// Client-side allowed types (the server route validates again).
const ALLOWED_TYPES = ['image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

// ---- Component ------------------------------------------------------------

export default function OnboardingStep3Page() {
  const params = useParams()
  const router = useRouter()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''
  const t = COPY[locale]

  // Load state
  const [loading, setLoading] = useState(true)

  // Form values
  const [cuisine, setCuisine] = useState('')
  const [description, setDescription] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  // Photo upload state
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Save state
  const [cardError, setCardError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ---- Load existing draft ----------------------------------------------
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
        if (r) {
          setCuisine(r.cuisine_type ?? '')
          setDescription(r.description ?? '')
          setPhotoUrl(r.hero_image_url ?? null)
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

  // ---- Photo upload ------------------------------------------------------
  const uploadFile = useCallback(
    async (file: File) => {
      setPhotoError(null)

      // Client-side validation (server validates again).
      if (!ALLOWED_TYPES.includes(file.type)) {
        setPhotoError(t.errorWrongType)
        return
      }
      if (file.size > MAX_BYTES) {
        setPhotoError(t.errorTooLarge)
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/v1/restaurants/photo', {
          method: 'POST',
          body: formData,
        })
        const data = (await res.json()) as
          | { ok: true; url: string }
          | { ok: false; error: string }

        if (data.ok) {
          setPhotoUrl(data.url)
        } else {
          setPhotoError(data.error || t.errorUploadFailed)
        }
      } catch {
        setPhotoError(t.errorUploadFailed)
      } finally {
        setUploading(false)
      }
    },
    [t.errorWrongType, t.errorTooLarge, t.errorUploadFailed]
  )

  const handleFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) void uploadFile(file)
      // Reset the input so the same file can be re-picked if needed.
      e.target.value = ''
    },
    [uploadFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void uploadFile(file)
    },
    [uploadFile]
  )

  // ---- Continue ----------------------------------------------------------
  const canContinue = (() => {
    if (loading || submitting || uploading) return false
    if (cuisine.trim().length === 0) return false
    if (!photoUrl) return false
    return true
  })()

  const handleContinue = useCallback(async () => {
    setSubmitting(true)
    setCardError(null)

    const writes: { field: string; value: string | null }[] = [
      { field: 'cuisine_type', value: cuisine.trim() || null },
      {
        field: 'description',
        value: description.trim().length > 0 ? description.trim() : null,
      },
    ]

    for (const w of writes) {
      const res = await saveDraft(w.field, w.value)
      if (!res.ok) {
        setCardError(res.error || t.saveErrorGeneric)
        setSubmitting(false)
        return
      }
    }

    router.push(`${localePrefix}/onboarding/step/4`)
  }, [cuisine, description, router, localePrefix, t.saveErrorGeneric])

  // ---- Render ------------------------------------------------------------

  return (
    <StepLayout
      currentStep={3}
      totalSteps={6}
      eyebrow={t.eyebrow}
      heading={t.heading}
      sub={t.sub}
      backHref={`${localePrefix}/onboarding/step/2`}
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
          {/* Cuisine select */}
          <div>
            <label style={labelStyle} htmlFor="cuisine">
              {t.cuisineLabel}
            </label>
            <select
              id="cuisine"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              style={{
                ...inputStyle,
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>
                {t.cuisinePlaceholder}
              </option>
              {CUISINE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Photo upload */}
          <div>
            <label style={labelStyle}>{t.photoLabel}</label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/webp"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />

            {photoUrl && !uploading ? (
              // Preview state
              <div>
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--cream)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt="Restaurant"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    marginTop: '10px',
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
                  {t.photoChange}
                </button>
              </div>
            ) : (
              // Drop zone
              <div
                onClick={() => {
                  if (!uploading) fileInputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '40px 24px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--cream)',
                  border: `2px dashed ${
                    photoError
                      ? '#ef4444'
                      : dragActive
                        ? 'var(--amber)'
                        : 'rgba(212,130,10,0.4)'
                  }`,
                  cursor: uploading ? 'default' : 'pointer',
                  textAlign: 'center',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Camera icon — custom inline SVG, no icon library */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.7A1 1 0 0 1 9.9 4h4.2a1 1 0 0 1 .8.4L16 6h2.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
                  <circle cx="12" cy="12.5" r="3.2" />
                </svg>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: 'var(--stone)',
                  }}
                >
                  {uploading ? t.photoUploading : t.photoInstruction}
                </div>
              </div>
            )}

            {photoError ? (
              <div style={errorTextStyle}>{photoError}</div>
            ) : (
              <div style={hintStyle}>{t.photoHint}</div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle} htmlFor="description">
              {t.descriptionLabel}
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.descriptionPlaceholder}
              maxLength={600}
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      )}
    </StepLayout>
  )
}
