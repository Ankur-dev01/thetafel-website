// lib/consumer/schemas/cancelSchema.ts
//
// Zod schemas for the cancel + change-request endpoints. Kept in one file
// so both routes share the token / slug validation shape.

import { z } from 'zod';

export const cancelBookingInputSchema = z.object({
  slug: z.string().min(1).max(120),
  token: z.string().min(40).max(120),
  turnstileToken: z.string().min(1),
  /** Client-generated UUID to guard against double-submit. */
  idempotencyKey: z.string().min(8).max(80),
});

export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

export const changeRequestInputSchema = z.object({
  slug: z.string().min(1).max(120),
  token: z.string().min(40).max(120),
  turnstileToken: z.string().min(1),
  /** Kind of change the guest wants. */
  changeKind: z.enum(['party_size', 'time', 'other']),
  /** Free-text detail, 3-500 chars. Sanitised server-side. */
  message: z.string().min(3).max(500),
});

export type ChangeRequestInput = z.infer<typeof changeRequestInputSchema>;
