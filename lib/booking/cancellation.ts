// lib/booking/cancellation.ts
//
// Cancellation policy — pure functions, no DB, no side effects.
// Given a booking's slot time, current time, and deposit amount, decides:
//   - is the guest allowed to cancel?
//   - is the cancellation within the refundable window?
//   - what is the refund amount in cents?
//
// The 24-hour default matches the SQL-side default in
// lookup_booking_by_magic_link. When we add restaurant-configurable
// windows later, this file is where we apply them.

export const CANCELLATION_DEADLINE_HOURS = 24;

export type CancellationDecision = {
  /** Is the booking eligible to cancel at all? False for already-cancelled, no-show, attended. */
  cancellable: boolean;
  /** UTC instant the guest must cancel by to receive a refund. Null if no deposit. */
  refundDeadlineUtc: Date | null;
  /** Is the caller within the refundable window? */
  withinRefundWindow: boolean;
  /** Refund amount in cents. 0 if outside window or no deposit. */
  refundCents: number;
  /** Currency. Empty string if no deposit. */
  refundCurrency: string;
  /** Machine-readable reason code for the UI to look up translations. */
  reason:
    | 'cancellable_full_refund'
    | 'cancellable_no_refund_past_deadline'
    | 'cancellable_no_deposit'
    | 'not_cancellable_status'
    | 'not_cancellable_past_slot';
};

export function decideCancellation(input: {
  bookingStatus: string;
  slotTimeUtc: Date;
  depositAmountCents: number | null;
  depositCurrency: string | null;
  now?: Date;
}): CancellationDecision {
  const now = input.now ?? new Date();

  // Terminal statuses can't be re-cancelled.
  if (
    input.bookingStatus === 'cancelled' ||
    input.bookingStatus === 'no_show' ||
    input.bookingStatus === 'attended'
  ) {
    return {
      cancellable: false,
      refundDeadlineUtc: null,
      withinRefundWindow: false,
      refundCents: 0,
      refundCurrency: '',
      reason: 'not_cancellable_status',
    };
  }

  // Can't cancel a booking that's already started (or is past).
  if (input.slotTimeUtc.getTime() <= now.getTime()) {
    return {
      cancellable: false,
      refundDeadlineUtc: null,
      withinRefundWindow: false,
      refundCents: 0,
      refundCurrency: '',
      reason: 'not_cancellable_past_slot',
    };
  }

  const hasDeposit =
    typeof input.depositAmountCents === 'number' &&
    input.depositAmountCents > 0 &&
    !!input.depositCurrency;

  if (!hasDeposit) {
    return {
      cancellable: true,
      refundDeadlineUtc: null,
      withinRefundWindow: false,
      refundCents: 0,
      refundCurrency: '',
      reason: 'cancellable_no_deposit',
    };
  }

  const refundDeadline = new Date(
    input.slotTimeUtc.getTime() - CANCELLATION_DEADLINE_HOURS * 3600 * 1000,
  );
  const withinRefundWindow = now.getTime() < refundDeadline.getTime();

  return {
    cancellable: true,
    refundDeadlineUtc: refundDeadline,
    withinRefundWindow,
    refundCents: withinRefundWindow ? (input.depositAmountCents ?? 0) : 0,
    refundCurrency: input.depositCurrency ?? '',
    reason: withinRefundWindow
      ? 'cancellable_full_refund'
      : 'cancellable_no_refund_past_deadline',
  };
}
