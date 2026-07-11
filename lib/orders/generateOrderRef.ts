// lib/orders/generateOrderRef.ts
//
// Server-side generator for orders.order_ref.
// Format: 'QR-XXXXXX' for QR orders, 'PU-XXXXXX' for takeaway (C6).
// The 6-char suffix uses Crockford base32 (no I, L, O, 0) so refs remain
// readable on paper receipts and over the phone.
//
// Collision handling: retries up to 5 times against the unique index.
// After that, throws — a collision after 5 tries on a 32^6 (≈1B) space is
// vanishingly unlikely and indicates something is wrong.

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32
const SUFFIX_LEN = 6
const MAX_ATTEMPTS = 5

export type OrderRefPrefix = 'QR' | 'PU'

function randomSuffix(): string {
  const bytes = new Uint8Array(SUFFIX_LEN)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < SUFFIX_LEN; i++) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length]
  }
  return out
}

export async function generateOrderRef(prefix: OrderRefPrefix): Promise<string> {
  const admin = await createSupabaseServerClientAdmin()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${prefix}-${randomSuffix()}`
    const { data, error } = await admin
      .from('orders')
      .select('id')
      .eq('order_ref', candidate)
      .maybeSingle()
    if (error) {
      // On a lookup error, still try the candidate — the UNIQUE index at
      // insert time is the real guarantee. Log for observability.
      console.warn('[generateOrderRef] lookup error, using candidate anyway', error.message)
      return candidate
    }
    if (!data) return candidate
  }
  throw new Error('generateOrderRef: exhausted retries — check unique index health')
}
