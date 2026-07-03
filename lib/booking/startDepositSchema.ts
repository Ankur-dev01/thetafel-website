// lib/booking/startDepositSchema.ts
//
// Zod schema for the POST /api/v1/public/{slug}/book/start-deposit body.
// Server-only. Deliberately does NOT accept an amount field — the amount is
// always recomputed server-side from config + partySize (PRD §14.8).

import 'server-only';
import { z } from 'zod';

const depositGuestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().min(1).max(32),
});

export const startDepositInputSchema = z.object({
  slug: z.string().min(1).max(120),
  partySize: z.number().int().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  slotInstant: z.string().min(20),
  guest: depositGuestSchema,
  method: z.enum(['ideal', 'creditcard']),
  locale: z.enum(['nl', 'en']),
  turnstileToken: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

export type StartDepositInput = z.infer<typeof startDepositInputSchema>;
