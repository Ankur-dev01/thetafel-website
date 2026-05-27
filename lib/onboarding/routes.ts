/**
 * Centralised step-routing helper.
 *
 * Single source of truth for where each step lives. Used by the sidebar,
 * StepFrame Back/Continue buttons, the services picker, and any redirect
 * that targets a specific step.
 */

import { ALL_STEPS } from './steps';

export type Locale = 'nl' | 'en';

/**
 * Returns the absolute path for the given step id.
 *
 *   stepPath(0, 'nl')  → '/onboarding/services'  (services picker)
 *   stepPath(1, 'nl')  → '/onboarding/business'
 *   stepPath(1, 'en')  → '/en/onboarding/business'
 *   stepPath(99, 'nl') → null (unknown step)
 */
export function stepPath(stepId: number, locale: Locale): string | null {
  const descriptor = ALL_STEPS.find((s) => s.id === stepId);
  if (!descriptor) return null;
  const localePrefix = locale === 'en' ? '/en' : '';
  return `${localePrefix}${descriptor.path}`;
}

/**
 * Returns the path of the step BEFORE the given one in the visible-steps
 * sequence. Returns null for the very first step (Back is hidden there).
 */
export function previousStepPath(
  currentStepId: number,
  visibleStepIds: number[],
  locale: Locale
): string | null {
  const idx = visibleStepIds.indexOf(currentStepId);
  if (idx <= 0) return null;
  const prevId = visibleStepIds[idx - 1]!;
  return stepPath(prevId, locale);
}

/**
 * Returns the path of the step AFTER the given one in the visible-steps
 * sequence. Returns null if at the last step.
 */
export function nextStepPath(
  currentStepId: number,
  visibleStepIds: number[],
  locale: Locale
): string | null {
  const idx = visibleStepIds.indexOf(currentStepId);
  if (idx === -1 || idx >= visibleStepIds.length - 1) return null;
  const nextId = visibleStepIds[idx + 1]!;
  return stepPath(nextId, locale);
}
