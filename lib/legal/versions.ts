// Current legal document versions in force.
// Bump these when publishing a new version of any document.
// The previous version's folder (e.g. lib/legal/terms/v1.0/) must remain
// intact in source for evidence purposes — restaurants who signed
// against an older version retain that as the binding text.

export const CURRENT_CONTRACT_VERSION = '1.0' as const;
export const CURRENT_TERMS_VERSION = '1.0' as const;
export const CURRENT_DPA_VERSION = '1.0' as const;

export type LegalLocale = 'nl' | 'en';
