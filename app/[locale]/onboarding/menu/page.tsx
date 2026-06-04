'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import ToggleField from '@/components/onboarding/fields/ToggleField'
import TextAreaField from '@/components/onboarding/fields/TextAreaField'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

// ---- Types -------------------------------------------------------------------

type MenuUpload = {
  id: string
  channel: 'takeaway' | 'qr' | 'both'
  upload_type: 'menu' | 'photo' | 'reference'
  storage_path: string
  original_filename: string
  file_size_bytes: number
  mime_type: string
  created_at: string
}

// ---- Constants ---------------------------------------------------------------

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const ACCEPTED_MIME = Object.keys(MIME_TO_EXT)
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_MENU_FILES = 5
const MAX_PHOTO_FILES = 10

// ---- Helpers -----------------------------------------------------------------

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function uuidV4(): string {
  return crypto.randomUUID()
}

// ---- Shared styles -----------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 600,
  fontSize: '18px',
  color: '#1e1508',
}

const sectionSubStyle: React.CSSProperties = {
  margin: '0 0 20px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: '#9c8b6a',
}

const subSectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 500,
  fontSize: '14px',
  color: '#1e1508',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

// ---- UploadZone (inline) -----------------------------------------------------

function UploadZone({
  onFiles,
  isUploading,
  disabled,
  acceptText,
  label,
}: {
  onFiles: (files: File[]) => void
  isUploading: boolean
  disabled?: boolean
  acceptText: string
  label: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (disabled || isUploading) return
    const dropped = Array.from(e.dataTransfer.files ?? [])
    if (dropped.length > 0) onFiles(dropped)
  }

  return (
    <div
      onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        padding: '32px',
        borderRadius: '12px',
        background: dragOver ? 'rgba(212,130,10,0.08)' : '#f8f2e6',
        border: dragOver ? '2px dashed #d4820a' : '2px dashed transparent',
        textAlign: 'center',
        cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(',')}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) onFiles(files)
          e.target.value = ''
        }}
      />
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '15px',
        color: '#1e1508',
        marginBottom: '6px',
      }}>
        {isUploading ? `${label} — …` : label}
      </div>
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '12px',
        color: '#9c8b6a',
      }}>
        {acceptText}
      </div>
    </div>
  )
}

// ---- PreviewCard (inline) ----------------------------------------------------

function PreviewCard({
  upload,
  onDelete,
}: {
  upload: MenuUpload
  onDelete: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: '#fdfaf5',
      borderRadius: '8px',
    }}>
      <div style={{ width: '32px', height: '32px', flexShrink: 0, color: '#d4820a' }}>
        {upload.mime_type === 'application/pdf' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '14px',
          color: '#1e1508',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {upload.original_filename}
        </div>
        <div style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '12px',
          color: '#9c8b6a',
        }}>
          {formatBytes(upload.file_size_bytes)}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          borderRadius: '6px',
          color: '#9c8b6a',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  )
}

// ---- Page --------------------------------------------------------------------

export default function MenuPage() {
  const t = useTranslations('onboarding.menu')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(8)

  // Service flags
  const [takeawayEnabled, setTakeawayEnabled] = useState(false)
  const [qrEnabled, setQrEnabled] = useState(false)

  // Scalar field state
  const [menuSameForBoth, setMenuSameForBoth] = useState(true)
  const [cuisineDescription, setCuisineDescription] = useState('')
  const [designPreferences, setDesignPreferences] = useState('')

  // Upload state
  const [menuUploads, setMenuUploads] = useState<MenuUpload[]>([])
  const [photoUploads, setPhotoUploads] = useState<MenuUpload[]>([])
  const [uploadingMenu, setUploadingMenu] = useState<null | 'takeaway' | 'qr' | 'both'>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadErrorMenu, setUploadErrorMenu] = useState<string | null>(null)
  const [uploadErrorPhoto, setUploadErrorPhoto] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

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
          setCurrentDisplayNum(getDisplayedStepNumber(8, visibleSteps) ?? 8)
        } catch {
          // leave defaults
        }

        setTakeawayEnabled(parseBool(r.service_takeaway_enabled, false))
        setQrEnabled(parseBool(r.service_qr_enabled, false))
        setMenuSameForBoth(parseBool(r.menu_same_for_both, true))
        setCuisineDescription(
          typeof r.menu_cuisine_description === 'string' ? r.menu_cuisine_description : ''
        )
        setDesignPreferences(
          typeof r.menu_design_preferences === 'string' ? r.menu_design_preferences : ''
        )
        setRestaurantId(typeof r.id === 'string' ? r.id : null)

        const allUploads = Array.isArray(data?.menu_uploads) ? data.menu_uploads : []
        setMenuUploads((allUploads as MenuUpload[]).filter((u) => u.upload_type === 'menu'))
        setPhotoUploads((allUploads as MenuUpload[]).filter((u) => u.upload_type === 'photo'))

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

  function buildMenuPatch() {
    return {
      menu_same_for_both: menuSameForBoth,
      menu_cuisine_description: cuisineDescription,
      menu_design_preferences: designPreferences,
    }
  }

  // ---- Scalar handlers -------------------------------------------------------

  function handleSameMenuChange(val: boolean) {
    if (!hydrated) return
    setMenuSameForBoth(val)
    save({ restaurant: { ...buildMenuPatch(), menu_same_for_both: val } })
  }

  function handleCuisineChange(val: string) {
    if (!hydrated) return
    if (val.length > 2000) return
    setCuisineDescription(val)
    save({ restaurant: { ...buildMenuPatch(), menu_cuisine_description: val } })
  }

  function handleDesignChange(val: string) {
    if (!hydrated) return
    if (val.length > 2000) return
    setDesignPreferences(val)
    save({ restaurant: { ...buildMenuPatch(), menu_design_preferences: val } })
  }

  // ---- Upload handler --------------------------------------------------------

  async function uploadFiles(
    files: File[],
    uploadType: 'menu' | 'photo',
    channel: 'takeaway' | 'qr' | 'both'
  ): Promise<void> {
    if (!restaurantId) {
      if (uploadType === 'menu') setUploadErrorMenu(t('uploadErrorNoRestaurant'))
      else setUploadErrorPhoto(t('uploadErrorNoRestaurant'))
      return
    }

    const currentCount = uploadType === 'menu' ? menuUploads.length : photoUploads.length
    const maxAllowed = uploadType === 'menu' ? MAX_MENU_FILES : MAX_PHOTO_FILES
    if (currentCount + files.length > maxAllowed) {
      const errKey = uploadType === 'menu' ? 'uploadErrorTooManyMenu' : 'uploadErrorTooManyPhotos'
      if (uploadType === 'menu') setUploadErrorMenu(t(errKey, { max: maxAllowed }))
      else setUploadErrorPhoto(t(errKey, { max: maxAllowed }))
      return
    }

    if (uploadType === 'menu') {
      setUploadingMenu(channel)
      setUploadErrorMenu(null)
    } else {
      setUploadingPhoto(true)
      setUploadErrorPhoto(null)
    }

    const supa = createSupabaseBrowserClient()
    const subfolder = uploadType === 'menu' ? 'menu' : 'photos'

    try {
      for (const file of files) {
        if (!ACCEPTED_MIME.includes(file.type)) {
          const msg = t('uploadErrorMime', { name: file.name })
          if (uploadType === 'menu') setUploadErrorMenu(msg)
          else setUploadErrorPhoto(msg)
          continue
        }
        if (file.size > MAX_FILE_BYTES) {
          const msg = t('uploadErrorSize', { name: file.name })
          if (uploadType === 'menu') setUploadErrorMenu(msg)
          else setUploadErrorPhoto(msg)
          continue
        }

        const uploadId = uuidV4()
        const ext = MIME_TO_EXT[file.type]!
        const storagePath = `${restaurantId}/${subfolder}/${uploadId}.${ext}`

        const { error: uploadErr } = await supa.storage
          .from('restaurant-menu-sources')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })

        if (uploadErr) {
          const msg = t('uploadErrorStorage', { name: file.name })
          if (uploadType === 'menu') setUploadErrorMenu(msg)
          else setUploadErrorPhoto(msg)
          continue
        }

        const metadata = {
          channel,
          upload_type: uploadType,
          storage_path: storagePath,
          original_filename: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
        }

        try {
          const res = await fetch('/api/v1/restaurants/draft', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ menu_uploads: [metadata] }),
          })
          if (!res.ok) {
            await supa.storage.from('restaurant-menu-sources').remove([storagePath])
            const msg = t('uploadErrorMetadata', { name: file.name })
            if (uploadType === 'menu') setUploadErrorMenu(msg)
            else setUploadErrorPhoto(msg)
            continue
          }
          const data = await res.json()
          const fresh = Array.isArray(data.menu_uploads) ? data.menu_uploads : []
          setMenuUploads((fresh as MenuUpload[]).filter((u) => u.upload_type === 'menu'))
          setPhotoUploads((fresh as MenuUpload[]).filter((u) => u.upload_type === 'photo'))
        } catch {
          await supa.storage.from('restaurant-menu-sources').remove([storagePath])
          const msg = t('uploadErrorMetadata', { name: file.name })
          if (uploadType === 'menu') setUploadErrorMenu(msg)
          else setUploadErrorPhoto(msg)
        }
      }
    } finally {
      if (uploadType === 'menu') setUploadingMenu(null)
      else setUploadingPhoto(false)
    }
  }

  // ---- Delete handler --------------------------------------------------------

  async function deleteUpload(uploadId: string, uploadType: 'menu' | 'photo'): Promise<void> {
    try {
      const res = await fetch(`/api/v1/restaurants/menu-source/${uploadId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        if (uploadType === 'menu') setUploadErrorMenu(t('deleteErrorMenu'))
        else setUploadErrorPhoto(t('deleteErrorPhoto'))
        return
      }
      if (uploadType === 'menu') {
        setMenuUploads((prev) => prev.filter((u) => u.id !== uploadId))
      } else {
        setPhotoUploads((prev) => prev.filter((u) => u.id !== uploadId))
      }
    } catch {
      if (uploadType === 'menu') setUploadErrorMenu(t('deleteErrorMenu'))
      else setUploadErrorPhoto(t('deleteErrorPhoto'))
    }
  }

  // ---- Continue handler ------------------------------------------------------

  async function handleContinue() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(8)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 9
      await saveNow({
        restaurant: { ...buildMenuPatch(), current_onboarding_step: nextStepId },
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

  const bothEnabled = takeawayEnabled && qrEnabled
  const serviceTagKey = bothEnabled
    ? 'serviceTagBoth'
    : takeawayEnabled
      ? 'serviceTagTakeaway'
      : 'serviceTagQr'

  const backHref = previousStepPath(8, visibleStepIds, locale) ?? stepPath(7, locale)

  // ---- Render ----------------------------------------------------------------

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      serviceTag={t(serviceTagKey)}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Section 1 — Same-menu toggle (only when both services enabled) */}
        {bothEnabled && (
          <section>
            <h2 style={sectionHeadingStyle}>{t('sameMenu.heading')}</h2>
            <p style={sectionSubStyle}>{t('sameMenu.sub')}</p>
            <ToggleField
              label={t('sameMenu.label')}
              description={t('sameMenu.description')}
              value={menuSameForBoth}
              onChange={handleSameMenuChange}
            />
          </section>
        )}

        {/* Section 2 — Menu file uploads */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('menuFiles.heading')}</h2>
          <p style={sectionSubStyle}>{t('menuFiles.sub')}</p>

          {bothEnabled && !menuSameForBoth ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Takeaway zone */}
              <div>
                <h3 style={subSectionHeadingStyle}>{t('menuFiles.takeawayHeading')}</h3>
                <UploadZone
                  onFiles={(files) => uploadFiles(files, 'menu', 'takeaway')}
                  isUploading={uploadingMenu === 'takeaway'}
                  acceptText={t('menuFiles.acceptText')}
                  label={t('menuFiles.dropLabel')}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {menuUploads
                    .filter((u) => u.channel === 'takeaway' || u.channel === 'both')
                    .map((u) => (
                      <PreviewCard key={u.id} upload={u} onDelete={() => deleteUpload(u.id, 'menu')} />
                    ))}
                </div>
              </div>

              {/* QR zone */}
              <div>
                <h3 style={subSectionHeadingStyle}>{t('menuFiles.qrHeading')}</h3>
                <UploadZone
                  onFiles={(files) => uploadFiles(files, 'menu', 'qr')}
                  isUploading={uploadingMenu === 'qr'}
                  acceptText={t('menuFiles.acceptText')}
                  label={t('menuFiles.dropLabel')}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {menuUploads
                    .filter((u) => u.channel === 'qr' || u.channel === 'both')
                    .map((u) => (
                      <PreviewCard key={u.id} upload={u} onDelete={() => deleteUpload(u.id, 'menu')} />
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <UploadZone
                onFiles={(files) => uploadFiles(files, 'menu', 'both')}
                isUploading={uploadingMenu === 'both'}
                acceptText={t('menuFiles.acceptText')}
                label={t('menuFiles.dropLabel')}
              />
              {menuUploads.map((u) => (
                <PreviewCard key={u.id} upload={u} onDelete={() => deleteUpload(u.id, 'menu')} />
              ))}
            </div>
          )}

          {uploadErrorMenu && (
            <p style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#c64a4a',
              marginTop: '8px',
            }}>
              {uploadErrorMenu}
            </p>
          )}
        </section>

        {/* Section 3 — Cuisine description */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('cuisine.heading')}</h2>
          <p style={sectionSubStyle}>{t('cuisine.sub')}</p>
          <TextAreaField
            label={t('cuisine.label')}
            hint={t('cuisine.hint')}
            placeholder={t('cuisine.placeholder')}
            value={cuisineDescription}
            onChange={handleCuisineChange}
            maxLength={2000}
            showCounter
            rows={4}
          />
        </section>

        {/* Section 4 — Photo uploads */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('photos.heading')}</h2>
          <p style={sectionSubStyle}>{t('photos.sub')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <UploadZone
              onFiles={(files) => uploadFiles(files, 'photo', 'both')}
              isUploading={uploadingPhoto}
              acceptText={t('photos.acceptText')}
              label={t('photos.dropLabel')}
            />
            {photoUploads.map((u) => (
              <PreviewCard key={u.id} upload={u} onDelete={() => deleteUpload(u.id, 'photo')} />
            ))}
          </div>
          {uploadErrorPhoto && (
            <p style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              color: '#c64a4a',
              marginTop: '8px',
            }}>
              {uploadErrorPhoto}
            </p>
          )}
        </section>

        {/* Section 5 — Design preferences */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('design.heading')}</h2>
          <p style={sectionSubStyle}>{t('design.sub')}</p>
          <TextAreaField
            label={t('design.label')}
            hint={t('design.hint')}
            placeholder={t('design.placeholder')}
            value={designPreferences}
            onChange={handleDesignChange}
            maxLength={2000}
            showCounter
            rows={4}
          />
        </section>

      </div>
    </StepFrame>
  )
}
