// app/api/dev/booking-config/route.ts
//
// Dev-only inspector for `loadBookingConfig`. Returns the resolved config or
// the error discriminator as JSON. Guarded against production by env check.
//
// Example:
//   GET /api/dev/booking-config?slug=draft-0abe63c4270d4e6e
//
// Returns 404 in production; 200 in dev/preview.

import { NextResponse, type NextRequest } from 'next/server';
import { loadBookingConfig } from '@/lib/booking/config';
import {
  earliestBookableInstant,
  latestBookableDate,
  depositAppliesForParty,
} from '@/lib/booking/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDevAllowed(): boolean {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return env !== 'production';
}

export async function GET(req: NextRequest) {
  if (!isDevAllowed()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') ?? '';
  if (!slug) {
    return NextResponse.json(
      { error: 'missing_slug', hint: 'pass ?slug=draft-0abe63c4270d4e6e' },
      { status: 400 },
    );
  }

  const result = await loadBookingConfig(slug);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  const now = new Date();
  return NextResponse.json(
    {
      ok: true,
      config: result.config,
      derived: {
        nowIso: now.toISOString(),
        earliestBookableInstant: earliestBookableInstant(result.config, now).toISOString(),
        latestBookableDate: latestBookableDate(result.config, now),
        depositAppliesForParty: {
          '1': depositAppliesForParty(result.config, 1),
          '4': depositAppliesForParty(result.config, 4),
          '8': depositAppliesForParty(result.config, 8),
        },
      },
    },
    { status: 200 },
  );
}
