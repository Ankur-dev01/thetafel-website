// app/api/v1/public/[slug]/book/change-request/route.ts
//
// POST /api/v1/public/{slug}/book/change-request
//
// Guest wants to change something about their booking. We collect a
// short structured message and email hallo@thetafel.nl. Phase 3 will
// route these directly to the restaurant.

import { NextResponse, type NextRequest } from 'next/server';
import { changeRequestInputSchema } from '@/lib/consumer/schemas/cancelSchema';
import { consumeBookingMagicLink } from '@/lib/consumer/magicLinks';
import { assertConsumerWriteAllowed } from '@/lib/consumer/guards';
import { checkConsumerRateLimit, getCallerIp, redactIp } from '@/lib/consumer/rateLimit';
import { verifyTurnstileToken } from '@/lib/consumer/turnstile';
import { auditLog } from '@/lib/consumer/audit';
import { sendConsumerEmail } from '@/lib/consumer/email/send';
import { renderBookingChangeRequest } from '@/lib/consumer/email/templates/bookingChangeRequest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeChangeMessage(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: slugParam } = await ctx.params;
  const ip = getCallerIp(req);
  const userAgent = req.headers.get('user-agent') ?? null;

  const rl = await checkConsumerRateLimit('booking_submit', ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds ?? 3600) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  const parsed = changeRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (input.slug !== slugParam) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const tv = await verifyTurnstileToken(input.turnstileToken, ip);
  if (!tv.ok) {
    return NextResponse.json({ ok: false, error: 'turnstile_failed' }, { status: 403 });
  }

  const consumed = await consumeBookingMagicLink({
    token: input.token,
    ipAddress: ip,
    userAgent,
  });
  if (!consumed.ok) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_expired_token' },
      { status: 403 },
    );
  }
  const b = consumed.payload;

  if (b.restaurantSlug !== slugParam) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_expired_token' },
      { status: 403 },
    );
  }

  const doorman = await assertConsumerWriteAllowed(b.restaurantId, 'booking.create');
  if (!doorman.ok) {
    return NextResponse.json(
      { ok: false, error: 'doorman_denied' },
      { status: doorman.httpStatus },
    );
  }

  const cleanMessage = sanitizeChangeMessage(input.message);

  const rendered = renderBookingChangeRequest({
    guestFullName: b.guestFullName,
    guestEmail: b.guestEmail,
    guestPhone: b.guestPhone,
    restaurantName: b.restaurantDisplayName ?? 'Unknown restaurant',
    restaurantSlug: b.restaurantSlug,
    bookingRef: b.bookingRef,
    slotTime: b.slotTime,
    partySize: b.partySize,
    changeKind: input.changeKind,
    message: cleanMessage,
  });

  const sendResult = await sendConsumerEmail({
    to: 'hallo@thetafel.nl',
    replyTo: b.guestEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateKey: 'booking.change_request',
    restaurantId: b.restaurantId,
    bookingId: b.bookingId,
  });

  await auditLog({
    restaurantId: b.restaurantId,
    eventType: 'booking.change_requested',
    eventData: {
      bookingRef: b.bookingRef,
      changeKind: input.changeKind,
      messageLength: cleanMessage.length,
      emailSent: sendResult.ok,
      ip_masked: redactIp(ip),
    },
    actorType: 'guest',
    bookingId: b.bookingId,
    ipAddress: ip,
    userAgent,
  }).catch(() => {});

  if (!sendResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'email_send_failed' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
