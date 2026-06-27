// lib/booking/guestValidation.ts
//
// Client-safe replicas of the validation rules in lib/consumer/sanitize.ts
// and lib/consumer/schemas.ts. Those files carry `import 'server-only'` and
// cannot be imported in client components. This file has no such restriction.
//
// Keep this in sync with the server-side originals whenever the server rules
// change. The exact regexes are copied from sanitize.ts to preserve parity.

/** Permissive RFC-ish email check (mirrors sanitize.ts isValidEmail). */
export function isValidEmailClient(s: string): boolean {
  if (typeof s !== 'string' || s.length > 254) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(s);
}

/**
 * Normalise phone to E.164 (mirrors sanitize.ts normalizePhone).
 * Returns null if no rule matches.
 */
export function normalizePhoneClient(s: string): string | null {
  if (typeof s !== 'string') return null;
  const stripped = s.replace(/[\s\-().]/g, '');
  if (!stripped) return null;

  if (stripped.startsWith('+')) {
    return /^\+[1-9][0-9]{1,14}$/.test(stripped) ? stripped : null;
  }
  if (/^0[0-9]{9}$/.test(stripped)) {
    return `+31${stripped.slice(1)}`;
  }
  if (/^[1-9][0-9]{6,14}$/.test(stripped)) {
    return `+${stripped}`;
  }
  return null;
}

/** E.164 validator (mirrors sanitize.ts isValidPhone). */
export function isValidPhoneClient(s: string): boolean {
  return /^\+[1-9][0-9]{1,14}$/.test(s);
}

export interface GuestFieldErrors {
  name?: true;
  email?: true;
  phone?: true;
}

/**
 * Validates the three required guest fields client-side.
 * Mirrors the rules in guestInputSchema (fullNameField, emailField, phoneField).
 * Note: draft uses `name` internally; C4.7 maps it to `fullName` on submit.
 */
export function validateGuestFields(
  name: string,
  email: string,
  phone: string,
): { valid: boolean; errors: GuestFieldErrors } {
  const errors: GuestFieldErrors = {};

  // fullNameField: sanitizeName collapses whitespace; min 2 chars
  if (name.trim().length < 2) errors.name = true;

  // emailField: normalizeEmail (lowercase+trim) then isValidEmail
  const normEmail = email.toLowerCase().trim();
  if (!isValidEmailClient(normEmail)) errors.email = true;

  // phoneField: normalizePhone then isValidPhone
  const normPhone = normalizePhoneClient(phone);
  if (normPhone === null || !isValidPhoneClient(normPhone)) errors.phone = true;

  return { valid: Object.keys(errors).length === 0, errors };
}
