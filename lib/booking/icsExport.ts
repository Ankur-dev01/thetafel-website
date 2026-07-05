// lib/booking/icsExport.ts
//
// iCalendar (.ics) generation for a confirmed booking.
//
// Produces a single-event VCALENDAR string compatible with Apple Calendar,
// Google Calendar (import), Outlook, and any RFC-5545 client.
//
// Also produces a Google Calendar "add event" URL for the one-click add
// path most guests will actually use on desktop.

export type IcsEventInput = {
  /** Stable UID for the event. We use bookingId + '@thetafel.nl'. */
  uid: string;
  /** Event start in UTC. */
  startUtc: Date;
  /** Duration in minutes. Used to compute end. */
  durationMinutes: number;
  /** Short summary shown in the calendar (e.g. "Reservering — Restaurant X"). */
  summary: string;
  /** Longer description (booking ref, party size, manage link). */
  description: string;
  /** Optional venue address as a single line. */
  location: string | null;
};

/** Format a Date as YYYYMMDDTHHmmssZ (RFC 5545 UTC form). */
function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Escape a text field per RFC 5545 §3.3.11 —
 * backslash, comma, semicolon and newline get backslash-escaped.
 */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold long lines per RFC 5545 §3.1 (75 octets, CRLF + space continuation).
 * We measure in JavaScript characters, which is close enough for our ASCII-plus-
 * accented-Latin text; multi-byte chars occasionally cross the 75-octet boundary
 * but all real-world calendar clients accept slightly longer lines.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/** Build a full VCALENDAR string containing one VEVENT. */
export function buildIcs(input: IcsEventInput): string {
  const endUtc = new Date(input.startUtc.getTime() + input.durationMinutes * 60_000);
  const now = new Date();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Tafel//Reservering//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(input.startUtc)}`,
    `DTEND:${formatUtc(endUtc)}`,
    `SUMMARY:${escapeIcsText(input.summary)}`,
    `DESCRIPTION:${escapeIcsText(input.description)}`,
  ];
  if (input.location) {
    lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Build a Google Calendar one-click "add event" URL.
 * Docs: https://support.google.com/calendar (query params: text, dates, details, location)
 */
export function buildGoogleCalendarUrl(input: {
  startUtc: Date;
  durationMinutes: number;
  summary: string;
  description: string;
  location: string | null;
}): string {
  const endUtc = new Date(input.startUtc.getTime() + input.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.summary,
    dates: `${formatUtc(input.startUtc)}/${formatUtc(endUtc)}`,
    details: input.description,
  });
  if (input.location) params.set('location', input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
