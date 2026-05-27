'use client';

/**
 * FileUploadField
 *
 * Drag-and-drop file upload that writes directly to a Supabase Storage
 * bucket using the user's session. Client-side validates MIME and size
 * before upload; RLS policies on the bucket enforce ownership server-side.
 *
 * Parent provides bucket + folderPath (must start with the restaurant
 * UUID — RLS will reject otherwise). On successful upload, calls
 * onUploaded with the file metadata. The parent decides what to do with
 * it (typically: save the storage_path to restaurants.hero_image_url or
 * append a row in menu_source_uploads via the draft route).
 */

import { useCallback, useId, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { type BaseFieldProps, requiredMarker } from '@/lib/onboarding/fieldTypes';

export type UploadedFileMetadata = {
  storagePath: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  /** Public URL if the bucket is public; null otherwise (use createSignedUrl in the parent). */
  publicUrl: string | null;
};

export type FileUploadFieldProps = BaseFieldProps & {
  bucket: string;
  /**
   * Folder path within the bucket. MUST start with the restaurant UUID
   * (e.g. `${restaurantId}/hero`) — RLS policies enforce this.
   */
  folderPath: string;
  accept?: string;
  maxSizeBytes?: number;
  isPublicBucket?: boolean;
  currentFile?: UploadedFileMetadata | null;
  onUploaded: (metadata: UploadedFileMetadata) => void;
  onRemoved: () => void;
};

// ---- Supabase client -----------------------------------------------------
// Uses the project-wide browser client (targets thetafel-prod, not the
// marketing site project).
const getBrowserClient = () => createSupabaseBrowserClient();

// ---- Helpers -------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// ---- Component -----------------------------------------------------------

type UploadStatus = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export default function FileUploadField({
  label,
  hint,
  error: externalError,
  required,
  disabled,
  id,
  className,
  bucket,
  folderPath,
  accept = 'image/jpeg,image/png,image/webp,application/pdf',
  maxSizeBytes = 5 * 1024 * 1024,
  isPublicBucket = false,
  currentFile,
  onUploaded,
  onRemoved,
}: FileUploadFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<UploadStatus>(
    currentFile ? 'success' : 'idle'
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);

  const displayError = externalError || internalError;
  const hasError = !!displayError || status === 'error';

  // ---- Validation --------------------------------------------------------

  const validate = useCallback(
    (file: File): string | null => {
      if (maxSizeBytes && file.size > maxSizeBytes) {
        return `File is too large (${formatBytes(file.size)}). Max ${formatBytes(maxSizeBytes)}.`;
      }
      const acceptList = accept.split(',').map((s) => s.trim());
      const acceptMatch = acceptList.some((pattern) => {
        if (pattern.endsWith('/*')) {
          return file.type.startsWith(pattern.slice(0, -1));
        }
        return file.type === pattern;
      });
      if (!acceptMatch) {
        return `File type not allowed (${file.type || 'unknown'}). Accepted: ${accept}.`;
      }
      return null;
    },
    [maxSizeBytes, accept]
  );

  // ---- Upload ------------------------------------------------------------

  const upload = useCallback(
    async (file: File) => {
      setInternalError(null);
      setStatus('validating');

      const validationError = validate(file);
      if (validationError) {
        setInternalError(validationError);
        setStatus('error');
        return;
      }

      setStatus('uploading');
      setProgress(0);

      const supabase = getBrowserClient();
      const cleanName = sanitizeFilename(file.name);
      const timestamp = Date.now();
      const storagePath = `${folderPath.replace(/^\/+|\/+$/g, '')}/${timestamp}-${cleanName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw new Error(uploadError.message);

        let publicUrl: string | null = null;
        if (isPublicBucket) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
          publicUrl = data.publicUrl;
        } else {
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(storagePath, 60 * 60);
          publicUrl = signed?.signedUrl ?? null;
        }

        setProgress(100);
        setStatus('success');

        onUploaded({
          storagePath,
          originalFilename: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          publicUrl,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload failed.';
        setInternalError(message);
        setStatus('error');
      }
    },
    [bucket, folderPath, isPublicBucket, onUploaded, validate]
  );

  // ---- Remove ------------------------------------------------------------

  const handleRemove = useCallback(async () => {
    const path = currentFile?.storagePath;
    if (path) {
      try {
        await getBrowserClient().storage.from(bucket).remove([path]);
      } catch {
        /* best-effort */
      }
    }
    setStatus('idle');
    setInternalError(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onRemoved();
  }, [bucket, currentFile, onRemoved]);

  // ---- Drag handlers -----------------------------------------------------

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  };

  const openPicker = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  // ---- Styles ------------------------------------------------------------

  const dropZoneStyle: React.CSSProperties = {
    position: 'relative',
    border: '2px dashed',
    borderColor: hasError
      ? '#ef4444'
      : isDragging
        ? '#d4820a'
        : 'rgba(212, 130, 10, 0.4)',
    borderRadius: '16px',
    backgroundColor: hasError
      ? '#fef2f2'
      : isDragging
        ? 'rgba(212, 130, 10, 0.08)'
        : '#f8f2e6',
    padding: '48px 24px',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s',
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  };

  // ---- Render ------------------------------------------------------------

  return (
    <div className={className} style={{ width: '100%' }}>
      <label
        htmlFor={inputId}
        style={{
          display: 'block',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#9c8b6a',
          marginBottom: '8px',
        }}
      >
        {label}
        {requiredMarker(required)}
      </label>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onFilePick}
        style={{ display: 'none' }}
      />

      {status === 'success' && currentFile && (
        <FilePreview file={currentFile} onRemove={handleRemove} disabled={disabled} />
      )}

      {status !== 'success' && (
        <div
          style={dropZoneStyle}
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Upload ${label}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
        >
          {status === 'idle' && <IdleContent />}
          {status === 'validating' && <SpinnerContent label="Checking…" />}
          {status === 'uploading' && (
            <SpinnerContent label={`Uploading… ${progress > 0 ? `${progress}%` : ''}`} />
          )}
          {status === 'error' && (
            <ErrorContent message={displayError ?? 'Upload failed.'} onRetry={openPicker} />
          )}
        </div>
      )}

      {(hint || displayError) && status !== 'error' && (
        <p
          style={{
            margin: '8px 2px 0',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            fontWeight: 400,
            color: hasError ? '#ef4444' : '#9c8b6a',
            lineHeight: 1.4,
          }}
        >
          {displayError || hint}
        </p>
      )}
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

function IdleContent() {
  return (
    <>
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d4820a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          color: '#1e1508',
        }}
      >
        Drag a file here or click to choose
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '12px',
          fontWeight: 400,
          color: '#9c8b6a',
        }}
      >
        JPG, PNG, WebP, or PDF
      </p>
    </>
  );
}

function SpinnerContent({ label }: { label: string }) {
  return (
    <>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d4820a"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ animation: 'fuf-spin 0.9s linear infinite' }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          color: '#1e1508',
        }}
      >
        {label}
      </p>
      <style>{`
        @keyframes fuf-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

function ErrorContent({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          color: '#ef4444',
        }}
      >
        {message}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        style={{
          padding: '8px 16px',
          marginTop: '6px',
          backgroundColor: '#d4820a',
          color: '#fdfaf5',
          border: 'none',
          borderRadius: '999px',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </>
  );
}

function FilePreview({
  file,
  onRemove,
  disabled,
}: {
  file: UploadedFileMetadata;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        backgroundColor: '#f8f2e6',
        border: '1.5px solid #f0e8d8',
      }}
    >
      {isImage(file.mimeType) && file.publicUrl ? (
        <img
          src={file.publicUrl}
          alt={file.originalFilename}
          style={{
            display: 'block',
            width: '100%',
            maxHeight: '320px',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '20px' }}>
          <FileIcon mimeType={file.mimeType} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: '#1e1508',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={file.originalFilename}
            >
              {file.originalFilename}
            </div>
            <div
              style={{
                marginTop: '2px',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '12px',
                color: '#9c8b6a',
              }}
            >
              {formatBytes(file.sizeBytes)} • {file.mimeType}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove file"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'rgba(30, 21, 8, 0.78)',
          color: '#fdfaf5',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (isPdf(mimeType)) {
    return (
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          backgroundColor: 'rgba(212, 130, 10, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4820a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <text x="7" y="18" fontSize="6" fill="#d4820a" stroke="none" fontWeight="700">PDF</text>
        </svg>
      </div>
    );
  }
  return (
    <div
      style={{
        width: '48px',
        height: '48px',
        borderRadius: '10px',
        backgroundColor: 'rgba(156, 139, 106, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9c8b6a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}
