// lib/consumer/schemas/privacySchema.ts
//
// Zod schemas for the GDPR data-request endpoints (C8.1).

import { z } from 'zod';

export const dataRequestInputSchema = z.object({
  email: z.string().min(3).max(254),
  /** Guest ticks a box confirming they're asking for their own data. */
  confirm: z.literal(true),
  turnstileToken: z.string().min(1),
  locale: z.enum(['nl', 'en']),
});

export type DataRequestInput = z.infer<typeof dataRequestInputSchema>;

export const dataRequestVerifyInputSchema = z.object({
  token: z.string().min(20).max(120),
});

export type DataRequestVerifyInput = z.infer<typeof dataRequestVerifyInputSchema>;
