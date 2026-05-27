/**
 * Shared types for onboarding form field components.
 *
 * Every field in components/onboarding/fields/ extends BaseFieldProps
 * for its label / hint / error / required / disabled props, then adds
 * its own value + onChange typed correctly.
 */

import type { ReactNode } from 'react';

export type BaseFieldProps = {
  /** UPPERCASE LABEL ABOVE THE INPUT */
  label: string;
  /** Small helper text below the input. */
  hint?: string;
  /** Error message. When present, the input border turns red and the error replaces the hint. */
  error?: string | null;
  /** Adds an amber asterisk after the label. Does NOT enforce validation — that's the page's job. */
  required?: boolean;
  /** Greys out the field and prevents interaction. */
  disabled?: boolean;
  /** Optional id; if omitted a stable one is auto-generated. */
  id?: string;
  /** Optional className appended to the outer wrapper for layout overrides. */
  className?: string;
};

export function requiredMarker(required: boolean | undefined): ReactNode {
  if (!required) return null;
  return (
    <span
      aria-hidden="true"
      style={{ color: '#d4820a', marginLeft: '4px' }}
    >
      *
    </span>
  );
}
