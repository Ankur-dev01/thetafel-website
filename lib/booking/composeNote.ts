// lib/booking/composeNote.ts
//
// Flatten the structured booking-question answers + free-form note into a
// single labeled string for storage in `bookings.guest_note`. Pure helper; no I/O.

interface NoteFields {
  allergies: string;
  occasion: string;
  requests: string;
  note: string;
  // Extra fields from GuestDraft are accepted but not used here.
  name?: string;
  email?: string;
  phone?: string;
}

interface ComposeOptions {
  showAllergies: boolean;
  showOccasion: boolean;
  showRequests: boolean;
  locale: string;
}

const LABELS: Record<string, { allergies: string; occasion: string; requests: string; note: string }> = {
  nl: {
    allergies: 'Allergieën',
    occasion: 'Speciale gelegenheid',
    requests: 'Bijzondere wensen',
    note: 'Opmerking',
  },
  en: {
    allergies: 'Allergies',
    occasion: 'Occasion',
    requests: 'Special requests',
    note: 'Note',
  },
};

export function composeGuestNote(fields: NoteFields, opts: ComposeOptions): string {
  const labels = LABELS[opts.locale] ?? LABELS.en;
  const parts: string[] = [];

  if (opts.showAllergies && fields.allergies.trim()) {
    parts.push(`${labels.allergies}: ${fields.allergies.trim()}`);
  }
  if (opts.showOccasion && fields.occasion.trim()) {
    parts.push(`${labels.occasion}: ${fields.occasion.trim()}`);
  }
  if (opts.showRequests && fields.requests.trim()) {
    parts.push(`${labels.requests}: ${fields.requests.trim()}`);
  }
  if (fields.note.trim()) {
    parts.push(`${labels.note}: ${fields.note.trim()}`);
  }

  return parts.join('\n');
}
