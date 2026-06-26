// app/api/dev/booking-config/route.ts
//
// Dev-only inspector. Three implicit modes:
//   1. ?slug=...                              -> BookingConfig + derived helpers
//   2. ?slug=...&date=YYYY-MM-DD&partySize=N  -> + loaded AvailabilityInputs
//                                              + computed AvailabilityResult
//
// Always 404 in production.

import { NextResponse, type NextRequest } from 'next/server';
import { loadBookingConfig } from '@/lib/booking/config';
import {
  earliestBookableInstant,
  latestBookableDate,
  depositAppliesForParty,
} from '@/lib/booking/types';
import { loadAvailabilityInputs } from '@/lib/booking/queries';
import { computeAvailability } from '@/lib/booking/computeAvailability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isDevAllowed(): boolean {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return env !== 'production';
}

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

export async function GET(req: NextRequest) {
  if (!isDevAllowed()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug') ?? '';
  const dateParam = searchParams.get('date');
  const partySizeParam = searchParams.get('partySize');

  if (!slug) {
    return NextResponse.json(
      {
        error: 'missing_slug',
        hint: 'pass ?slug=draft-0abe63c4270d4e6e (optionally &date=YYYY-MM-DD&partySize=N)',
      },
      { status: 400 },
    );
  }

  const configResult = await loadBookingConfig(slug);
  if (!configResult.ok) {
    return NextResponse.json({ ok: false, error: configResult.error }, { status: 200 });
  }
  const config = configResult.config;

  const now = new Date();
  const base = {
    ok: true as const,
    config,
    derived: {
      nowIso: now.toISOString(),
      earliestBookableInstant: earliestBookableInstant(config, now).toISOString(),
      latestBookableDate: latestBookableDate(config, now),
      depositAppliesForParty: {
        '1': depositAppliesForParty(config, 1),
        '4': depositAppliesForParty(config, 4),
        '8': depositAppliesForParty(config, 8),
      },
    },
  };

  if (!dateParam) {
    return NextResponse.json(base, { status: 200 });
  }
  if (!isValidLocalDate(dateParam)) {
    return NextResponse.json(
      { ...base, inputs: null, inputsError: 'invalid_date_format', availability: null },
      { status: 200 },
    );
  }

  const partySize = partySizeParam ? Number(partySizeParam) : 2;
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
    return NextResponse.json(
      { ...base, inputs: null, inputsError: 'invalid_party_size', availability: null },
      { status: 200 },
    );
  }

  const inputs = await loadAvailabilityInputs(config, dateParam);
  const serializedInputs = {
    dateLocal: inputs.dateLocal,
    isoDayOfWeek: inputs.isoDayOfWeek,
    windows: inputs.windows.map((w) => ({
      id: w.id,
      openInstant: w.openInstant.toISOString(),
      closeInstant: w.closeInstant.toISOString(),
      closesNextDay: w.closesNextDay,
      serviceScope: w.serviceScope,
      tags: w.tags,
    })),
    zones: inputs.zones,
    existingBookings: inputs.existingBookings.map((b) => ({
      ...b,
      slotInstant: b.slotInstant.toISOString(),
    })),
    summary: {
      windowCount: inputs.windows.length,
      zoneCount: inputs.zones.length,
      totalBookableTables: inputs.zones.reduce((n, z) => n + z.tables.length, 0),
      candidateTablesForParty: inputs.zones.reduce(
        (n, z) => n + z.tables.filter((t) => t.seats >= partySize).length,
        0,
      ),
      activeBookingsLoaded: inputs.existingBookings.length,
    },
  };

  const availability = computeAvailability(config, inputs, partySize, now);

  return NextResponse.json(
    {
      ...base,
      partySize,
      inputs: serializedInputs,
      availability: {
        ...availability,
        slotCount: availability.slots.length,
        firstSlot: availability.slots[0] ?? null,
        lastSlot: availability.slots[availability.slots.length - 1] ?? null,
      },
    },
    { status: 200 },
  );
}
