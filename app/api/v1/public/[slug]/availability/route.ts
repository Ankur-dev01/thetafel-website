// app/api/v1/public/[slug]/availability/route.ts
//
// GET /api/v1/public/{slug}/availability?date=YYYY-MM-DD&partySize=N
//
// Public, anonymous, rate-limited. Returns the slot grid for one
// (restaurant, date, partySize) combination.

import { NextResponse, type NextRequest } from 'next/server';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadAvailabilityInputs } from '@/lib/booking/queries';
import { computeAvailability } from '@/lib/booking/computeAvailability';
import {
  checkConsumerRateLimit,
  getCallerIp,
  rateLimitHeaders,
} from '@/lib/consumer/rateLimit';
import { auditLog } from '@/lib/consumer/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidLocalDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const ip = getCallerIp(req);

  // 1. Rate limit (60 req / IP / min).
  const rl = await checkConsumerRateLimit('availability_query', ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // 2. Parse query params.
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') ?? '';
  const partySizeRaw = searchParams.get('partySize') ?? '';

  if (!isValidLocalDate(date)) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }
  const partySize = Number(partySizeRaw);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    return NextResponse.json({ ok: false, error: 'invalid_party_size' }, { status: 400 });
  }

  // 3. Load config.
  const cfg = await loadBookingConfig(slug);
  if (!cfg.ok) {
    return NextResponse.json({ ok: false, error: cfg.error }, { status: 200 });
  }

  // 4. Load inputs + compute.
  const inputs = await loadAvailabilityInputs(cfg.config, date);
  const result = computeAvailability(cfg.config, inputs, partySize);

  // 5. Audit (best-effort; never throws).
  try {
    await auditLog({
      restaurantId: cfg.config.restaurantId,
      eventType: 'booking.availability.queried',
      eventData: {
        slug,
        date,
        partySize,
        slots: result.slots.length,
        closed: result.closed,
        beyondWindow: result.beyondWindow,
        partyTooLarge: result.partyTooLarge,
        inPast: result.inPast,
      },
      actorType: 'guest',
      ipAddress: ip,
    });
  } catch {
    /* swallow */
  }

  return NextResponse.json(
    { ok: true, ...result },
    {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=15',
      },
    },
  );
}
