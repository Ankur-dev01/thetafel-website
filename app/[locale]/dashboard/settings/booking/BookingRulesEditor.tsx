'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BookingRulesSection from './BookingRulesSection';
import NoShowSection from './NoShowSection';
import GuestExperienceSection from './GuestExperienceSection';
import { useBookingRulesActions } from '@/lib/dashboard/actions/bookingRulesActions';
import { validateBookingRulesPayload } from '@/lib/dashboard/settings/bookingRulesValidation';
import type { BookingRulesPayload } from '@/lib/dashboard/settings/bookingRulesValidation';
import type { BookingRulesInitialData } from '@/lib/dashboard/queries/bookingRules';

type BookingRulesEditorProps = {
  initialData: BookingRulesInitialData;
  restaurantName: string;
  restaurantAddress: string;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  whatsapp_needs_premium: 'errors.whatsappNeedsPremium',
  prepaid_needs_mollie: 'errors.prepaidNeedsMollie',
  prepaid_threshold_required: 'errors.prepaidThresholdRequired',
  template_missing_restaurant: 'errors.templateMissingRestaurant',
  template_unknown_placeholder: 'errors.templateUnknownPlaceholder',
  validation_error: 'errors.saveFailed',
  db_error: 'errors.saveFailed',
  network_error: 'errors.saveFailed',
  unknown_error: 'errors.saveFailed',
};

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;

export default function BookingRulesEditor({ initialData, restaurantName, restaurantAddress }: BookingRulesEditorProps) {
  const t = useTranslations('dashboard.settings.booking');
  const { pending, saveBookingRules } = useBookingRulesActions();

  const [baseline, setBaseline] = useState<BookingRulesPayload>(initialData.rules);
  const [rules, setRules] = useState<BookingRulesPayload>(initialData.rules);
  const [savedToast, setSavedToast] = useState(false);
  const [saveError, setSaveError] = useState<{ code: string; token?: string } | null>(null);

  function patch(next: Partial<BookingRulesPayload>) {
    setRules((prev) => ({ ...prev, ...next }));
    setSavedToast(false);
    setSaveError(null);
  }

  const dirty = JSON.stringify(rules) !== JSON.stringify(baseline);
  const clientError = validateBookingRulesPayload(rules, {
    isPremiumTier: initialData.isPremiumTier,
    mollieVerified: initialData.mollieVerified,
  });
  const canSave = dirty && !clientError && !pending;

  function handleCancel() {
    setRules(baseline);
    setSavedToast(false);
    setSaveError(null);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveError(null);
    const result = await saveBookingRules(rules);
    if (result.ok) {
      setBaseline(rules);
      setSavedToast(true);
    } else {
      setSaveError({ code: result.code, token: result.token });
    }
  }

  const displayedError = saveError ?? (dirty && clientError ? { code: clientError.code, token: clientError.token } : null);

  return (
    <div className="pb-24">
      {savedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-full shadow-[0_8px_24px_rgba(30,21,8,0.18)] px-4 py-2.5"
          data-testid="booking-saved-toast"
        >
          <span className="text-[13px] text-[#1e1508]" style={bodyStyle}>
            {t('savedToast')}
          </span>
        </div>
      )}

      <BookingRulesSection
        minLeadTimeMinutes={rules.min_lead_time_minutes}
        maxPartySizeOnline={rules.max_party_size_online}
        bookingWindowDays={rules.booking_window_days}
        maxGuestsPerSlot={rules.max_guests_per_slot}
        waitlistEnabled={rules.waitlist_enabled}
        guestZoneChoiceEnabled={rules.guest_zone_choice_enabled}
        onChangeMinLeadTime={(v) => patch({ min_lead_time_minutes: v })}
        onChangeMaxPartySize={(v) => patch({ max_party_size_online: v })}
        onChangeBookingWindow={(v) => patch({ booking_window_days: v })}
        onChangeMaxGuestsPerSlot={(v) => patch({ max_guests_per_slot: v })}
        onChangeWaitlist={(v) => patch({ waitlist_enabled: v })}
        onChangeZoneChoice={(v) => patch({ guest_zone_choice_enabled: v })}
        disabled={pending}
      />

      <NoShowSection
        emailEnabled={rules.noshow_reminders_email_enabled}
        whatsappEnabled={rules.noshow_reminders_whatsapp_enabled}
        reconfirmationEnabled={rules.noshow_reconfirmation_enabled}
        prepaidEnabled={rules.noshow_prepaid_enabled}
        prepaidAmountCents={rules.noshow_prepaid_amount_cents}
        prepaidThreshold={rules.noshow_prepaid_threshold}
        isPremiumTier={initialData.isPremiumTier}
        mollieVerified={initialData.mollieVerified}
        hasAdvancedPrepaidWindow={initialData.hasAdvancedPrepaidWindow}
        onChangeEmail={(v) => patch({ noshow_reminders_email_enabled: v })}
        onChangeWhatsapp={(v) => patch({ noshow_reminders_whatsapp_enabled: v })}
        onChangeReconfirmation={(v) => patch({ noshow_reconfirmation_enabled: v })}
        onChangePrepaidEnabled={(v) =>
          patch(
            v
              ? { noshow_prepaid_enabled: true, noshow_prepaid_amount_cents: rules.noshow_prepaid_amount_cents ?? 100, noshow_prepaid_threshold: rules.noshow_prepaid_threshold ?? 1 }
              : { noshow_prepaid_enabled: false, noshow_prepaid_amount_cents: null, noshow_prepaid_threshold: null },
          )
        }
        onChangePrepaidAmountCents={(v) => patch({ noshow_prepaid_amount_cents: v })}
        onChangePrepaidThreshold={(v) => patch({ noshow_prepaid_threshold: v })}
        disabled={pending}
      />

      <GuestExperienceSection
        templateNl={rules.confirmation_template_nl}
        templateEn={rules.confirmation_template_en}
        questionAllergies={rules.booking_question_allergies}
        questionOccasion={rules.booking_question_occasion}
        questionRequests={rules.booking_question_requests}
        onChangeTemplateNl={(v) => patch({ confirmation_template_nl: v })}
        onChangeTemplateEn={(v) => patch({ confirmation_template_en: v })}
        onChangeQuestionAllergies={(v) => patch({ booking_question_allergies: v })}
        onChangeQuestionOccasion={(v) => patch({ booking_question_occasion: v })}
        onChangeQuestionRequests={(v) => patch({ booking_question_requests: v })}
        disabled={pending}
        restaurantName={restaurantName}
        restaurantAddress={restaurantAddress}
      />

      {displayedError && (
        <p className="text-[13px] text-[#b3422f]" data-testid="booking-form-error">
          {displayedError.code === 'template_unknown_placeholder'
            ? t('errors.templateUnknownPlaceholder', { placeholder: displayedError.token ?? '?' })
            : t(ERROR_CODE_KEYS[displayedError.code] ?? 'errors.saveFailed')}
        </p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[#f7f2e9] border-t border-[#e7ddc9] px-5 py-3 flex justify-end gap-2 z-40">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending || !dirty}
          data-testid="booking-cancel"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="booking-save"
          className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508] disabled:opacity-50"
          style={labelStyle}
        >
          {pending ? t('actions.saving') : t('actions.save')}
        </button>
      </div>
    </div>
  );
}
