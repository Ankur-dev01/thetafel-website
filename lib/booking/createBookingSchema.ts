// lib/booking/createBookingSchema.ts
//
// Zod schema for the POST /api/consumer/bookings/create body. Server-only.
// Guest sub-schema uses `name` to match BookingDraft.guest.name (GuestDraft).

import 'server-only';
import { z } from 'zod';

const bookingGuestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  phone: z.string().min(1).max(32),
  note: z.string().max(500).optional().default(''),
});

export const createBookingInputSchema = z.object({
  slug: z.string().min(1).max(120),
  partySize: z.number().int().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  slotInstant: z.string().min(20),
  zoneId: z.string().uuid().nullable(),
  selectedSlotZoneIds: z.array(z.string().uuid()).min(1).max(20),
  guest: bookingGuestSchema,
  allergies: z.string().max(200).default(''),
  occasion: z.string().max(200).default(''),
  requests: z.string().max(200).default(''),
  marketingConsent: z.boolean(),
  locale: z.enum(['nl', 'en']),
  turnstileToken: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
