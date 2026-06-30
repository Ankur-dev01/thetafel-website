// lib/booking/bookingRef.ts
//
// Generate a public booking reference like "TFL-A3F9K2".
// 6 base-36 chars after the prefix → 2.1 billion combinations.
// Collision check is the caller's responsibility (retry once on duplicate).

import { randomBytes } from 'node:crypto';

export function generateBookingRef(): string {
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0);
  const s = n.toString(36).toUpperCase().padStart(7, '0').slice(0, 6);
  return `TFL-${s}`;
}
