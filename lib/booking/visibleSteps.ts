// lib/booking/visibleSteps.ts
//
// Pure helper: which raw step IDs (1..6) are visible to the current user
// given the draft and config?
//
// R1 = date+party (always)
// R2 = slot picker (always)
// R3 = zone picker (when guestZoneChoiceEnabled AND >1 zones at picked slot)
// R4 = guest details (always)
// R5 = deposit / Mollie (when deposit applies for the chosen party size)
// R6 = review (always)
//
// Order is monotonically increasing.

import type { BookingConfig, BookingDraft } from './types';
import { depositAppliesForParty } from './types';

export function computeVisibleSteps(draft: BookingDraft, config: BookingConfig): number[] {
  const steps: number[] = [1, 2];

  if (config.guestZoneChoiceEnabled && draft.selectedSlotZoneIds.length > 1) {
    steps.push(3);
  }

  steps.push(4);

  if (draft.partySize != null && depositAppliesForParty(config, draft.partySize)) {
    steps.push(5);
  }

  steps.push(6);
  return steps;
}
