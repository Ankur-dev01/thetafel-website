'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNotificationsActions } from '@/lib/dashboard/actions/notificationsActions';

type EditableFields = {
  notify_booking_confirmed: boolean;
  notify_booking_cancelled: boolean;
  notify_order_confirmed: boolean;
  notify_order_ready: boolean;
  notify_restaurant_new_booking: boolean;
  notify_restaurant_new_order: boolean;
  notify_restaurant_booking_cancelled: boolean;
};

type Labels = {
  guestNotificationsSectionTitle: string;
  guestNotificationsSectionDescription: string;
  eventBookingConfirmed: string;
  eventBookingConfirmedDesc: string;
  eventBookingCancelled: string;
  eventBookingCancelledDesc: string;
  eventOrderConfirmed: string;
  eventOrderConfirmedDesc: string;
  eventOrderReady: string;
  eventOrderReadyDesc: string;
  emailChannel: string;
  whatsappChannel: string;
  comingSoon: string;
  offWarning: string;
  save: string;
  saving: string;
  saved: string;
  saveError: string;
  cancel: string;
  restaurantNotificationsTitle: string;
  restaurantNotificationsDescription: string;
  restaurantEventNewBooking: string;
  restaurantEventNewBookingDesc: string;
  restaurantEventNewOrder: string;
  restaurantEventNewOrderDesc: string;
  restaurantEventBookingCancelled: string;
  restaurantEventBookingCancelledDesc: string;
};

type Props = {
  initial: EditableFields;
  /** Server-rendered "Sent to X" / "No email set" status line (t.rich). */
  restaurantEmailStatus: ReactNode;
  labels: Labels;
};

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const;

export default function NotificationsForm({ initial, restaurantEmailStatus, labels }: Props) {
  const { pending, saveNotifications } = useNotificationsActions();

  const [baseline, setBaseline] = useState<EditableFields>(initial);
  const [values, setValues] = useState<EditableFields>(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const dirty = (Object.keys(baseline) as (keyof EditableFields)[]).some(
    (k) => values[k] !== baseline[k],
  );
  const canSave = dirty && !pending;

  function toggle(k: keyof EditableFields) {
    setValues((v) => ({ ...v, [k]: !v[k] }));
    setSavedToast(false);
  }

  function handleCancel() {
    setValues(baseline);
    setFormError(null);
    setSavedToast(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setFormError(null);
    const result = await saveNotifications(values);
    if (result.ok) {
      setBaseline(values);
      setSavedToast(true);
    } else {
      setFormError(labels.saveError);
    }
  }

  type EventRow = { key: keyof EditableFields; title: string; desc: string; testId: string };

  const events: EventRow[] = [
    {
      key: 'notify_booking_confirmed',
      title: labels.eventBookingConfirmed,
      desc: labels.eventBookingConfirmedDesc,
      testId: 'notify-booking-confirmed',
    },
    {
      key: 'notify_booking_cancelled',
      title: labels.eventBookingCancelled,
      desc: labels.eventBookingCancelledDesc,
      testId: 'notify-booking-cancelled',
    },
    {
      key: 'notify_order_confirmed',
      title: labels.eventOrderConfirmed,
      desc: labels.eventOrderConfirmedDesc,
      testId: 'notify-order-confirmed',
    },
    {
      key: 'notify_order_ready',
      title: labels.eventOrderReady,
      desc: labels.eventOrderReadyDesc,
      testId: 'notify-order-ready',
    },
  ];

  // Restaurant-facing events (D5.6b) — the owner's own inbox, so turning
  // one off is harmless. No off-warning on these rows.
  const restaurantEvents: EventRow[] = [
    {
      key: 'notify_restaurant_new_booking',
      title: labels.restaurantEventNewBooking,
      desc: labels.restaurantEventNewBookingDesc,
      testId: 'notify-restaurant-new-booking',
    },
    {
      key: 'notify_restaurant_new_order',
      title: labels.restaurantEventNewOrder,
      desc: labels.restaurantEventNewOrderDesc,
      testId: 'notify-restaurant-new-order',
    },
    {
      key: 'notify_restaurant_booking_cancelled',
      title: labels.restaurantEventBookingCancelled,
      desc: labels.restaurantEventBookingCancelledDesc,
      testId: 'notify-restaurant-booking-cancelled',
    },
  ];

  function renderEventRow(e: EventRow, showOffWarning: boolean) {
    return (
      <div key={e.key} className="border-t border-[#f0e8d6] pt-4 first:border-t-0 first:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-[#1e1508]" style={labelStyle}>
              {e.title}
            </div>
            <p className="mt-1 text-[12px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
              {e.desc}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="inline-flex items-center gap-2 cursor-pointer tafel-tap">
            <input
              type="checkbox"
              checked={values[e.key]}
              onChange={() => toggle(e.key)}
              data-testid={e.testId}
              className="w-4 h-4 rounded border border-[#e7ddc9] accent-amber"
            />
            <span className="text-[12px] uppercase tracking-[0.06em] text-[#1e1508]" style={labelStyle}>
              {labels.emailChannel}
            </span>
          </label>

          <span
            className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.06em] text-[#a49d8c]"
            title={labels.comingSoon}
            style={labelStyle}
          >
            <span className="w-4 h-4 rounded border border-[#e7ddc9] bg-[#faf5ea]" />
            {labels.whatsappChannel} &middot; {labels.comingSoon}
          </span>
        </div>

        {showOffWarning && !values[e.key] && (
          <p
            className="mt-2 text-[12px] text-[#c2410c] leading-relaxed"
            data-testid={`${e.testId}-warning`}
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {labels.offWarning}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="notifications-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {labels.saved}
          </span>
        </div>
      )}

      <section className="mt-4 bg-white rounded-card p-5" data-testid="notifications-guest-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.guestNotificationsSectionTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.guestNotificationsSectionDescription}
        </p>

        <div className="mt-5 space-y-5">{events.map((e) => renderEventRow(e, true))}</div>

        {formError && (
          <p
            className="mt-4 text-[13px] text-[#b3422f]"
            data-testid="notifications-form-error"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {formError}
          </p>
        )}
      </section>

      <section className="mt-4 bg-white rounded-card p-5" data-testid="notifications-restaurant-card">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.restaurantNotificationsTitle}
        </h2>
        <p className="mt-1 text-[13px] text-[#6f6353] leading-relaxed" style={bodyStyle}>
          {labels.restaurantNotificationsDescription}
        </p>
        <p
          className="mt-2 text-[13px] text-[#6f6353] leading-relaxed"
          data-testid="notifications-restaurant-email-status"
          style={bodyStyle}
        >
          {restaurantEmailStatus}
        </p>

        <div className="mt-5 space-y-5">{restaurantEvents.map((e) => renderEventRow(e, false))}</div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="notifications-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {labels.cancel}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="notifications-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}
