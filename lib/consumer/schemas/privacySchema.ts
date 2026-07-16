// lib/consumer/schemas/privacySchema.ts
//
// Zod schemas for the GDPR data-request and data-deletion endpoints (C8.1, C8.2).

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

export const dataDeletionInputSchema = z.object({
  email: z.string().min(3).max(254),
  /** Guest ticks a box confirming they understand deletion is irreversible. */
  confirm: z.literal(true),
  turnstileToken: z.string().min(1),
  locale: z.enum(['nl', 'en']),
});

export type DataDeletionInput = z.infer<typeof dataDeletionInputSchema>;

export const dataDeletionVerifyInputSchema = z.object({
  token: z.string().min(20).max(120),
});

export type DataDeletionVerifyInput = z.infer<typeof dataDeletionVerifyInputSchema>;
