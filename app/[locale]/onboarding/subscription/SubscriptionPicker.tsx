'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import StepFrame from '@/components/onboarding/shell/StepFrame';
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator';
import { useDraftSave } from '@/lib/onboarding/useDraftSave';
import { nextStepPath } from '@/lib/onboarding/routes';
import {
  calculatePricing,
  formatEuros,
  applyVat,
  TIER_MONTHLY_CENTS,
  QR_SETUP_CENTS,
  type SubscriptionTier,
  type QrPlan,
  type PricingBreakdown,
} from '@/lib/pricing/subscription';

// ---- Feature matrix ---------------------------------------------------------

type FeatureKey =
  | 'reservations'
  | 'unlimitedBookings'
  | 'takeaway'
  | 'qrOrdering'
  | 'emailConfirmations'
  | 'whatsappReminders'
  | 'prioritySupport';

const FEATURE_ORDER: FeatureKey[] = [
  'reservations',
  'unlimitedBookings',
  'takeaway',
  'qrOrdering',
  'emailConfirmations',
  'whatsappReminders',
  'prioritySupport',
];

const TIER_FEATURES: Record<SubscriptionTier, Record<FeatureKey, boolean>> = {
  starter: {
    reservations: true,
    unlimitedBookings: false,
    takeaway: false,
    qrOrdering: false,
    emailConfirmations: true,
    whatsappReminders: false,
    prioritySupport: false,
  },
  plus: {
    reservations: true,
    unlimitedBookings: true,
    takeaway: true,
    qrOrdering: false,
    emailConfirmations: true,
    whatsappReminders: false,
    prioritySupport: false,
  },
  premium: {
    reservations: true,
    unlimitedBookings: true,
    takeaway: true,
    qrOrdering: true,
    emailConfirmations: true,
    whatsappReminders: true,
    prioritySupport: true,
  },
};

const TIERS: SubscriptionTier[] = ['starter', 'plus', 'premium'];
const QR_PLANS: QrPlan[] = ['basic', 'premium'];

// ---- A11y -------------------------------------------------------------------

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

// ---- SVG icons (currentColor lets parent control colour) --------------------

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7.2l2.6 2.6L11 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Props ------------------------------------------------------------------

type Props = {
  locale: 'nl' | 'en';
  restaurantId: string;
  initialTier: SubscriptionTier | null;
  initialQrPlan: QrPlan | null;
  qrOrderingEnabled: boolean;
  qrTableCount: number;
  initialPricing: PricingBreakdown;
  currentDisplayNum: number;
  totalSteps: number;
  backHref: string | null;
  visibleStepIds: number[];
};

// ---- Component --------------------------------------------------------------

export default function SubscriptionPicker({
  locale,
  restaurantId: _restaurantId,
  initialTier,
  initialQrPlan,
  qrOrderingEnabled,
  qrTableCount,
  initialPricing: _initialPricing,
  currentDisplayNum,
  totalSteps,
  backHref,
  visibleStepIds,
}: Props) {
  const t = useTranslations('onboarding.subscription');
  const router = useRouter();
  const pathname = usePathname();
  const { state: saveState, save, saveNow } = useDraftSave();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(initialTier);
  const [qrPlan, setQrPlan] = useState<QrPlan | null>(initialQrPlan);
  const [showDowngradeNotice, setShowDowngradeNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hoveredTier, setHoveredTier] = useState<SubscriptionTier | null>(null);
  const [hoveredQrPlan, setHoveredQrPlan] = useState<QrPlan | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Re-sync on soft-nav return (lesson #10.15)
  useEffect(() => {
    setSelectedTier(initialTier);
    setQrPlan(initialQrPlan);
    setShowDowngradeNotice(false);
  }, [pathname, initialTier, initialQrPlan]);

  useEffect(() => {
    setPrefersReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }, []);

  const pricing = calculatePricing({ tier: selectedTier, qrPlan, qrTableCount });

  // Tier selection autosaves on click (debounced) so back-nav preserves state
  function handleSelectTier(nextTier: SubscriptionTier) {
    setSelectedTier(nextTier);
    setShowDowngradeNotice(false);

    const patch: { subscription_tier: SubscriptionTier; qr_plan?: QrPlan | null } = {
      subscription_tier: nextTier,
    };

    // Auto-revert QR Premium → Basic when switching to a non-Premium tier
    if (nextTier !== 'premium' && qrPlan === 'premium') {
      patch.qr_plan = 'basic';
      setQrPlan('basic');
      setShowDowngradeNotice(true);
    }

    save({ restaurant: patch });
  }

  function handleSelectQrPlan(nextPlan: QrPlan) {
    setQrPlan(nextPlan);
    save({ restaurant: { qr_plan: nextPlan } });
  }

  // Continue only advances the step — tier is already persisted from click
  async function handleContinue() {
    if (!selectedTier || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveNow({ restaurant: { current_onboarding_step: 13 } });
      const next = nextStepPath(12, visibleStepIds, locale);
      if (next) router.push(next);
    } catch {
      setSaveError(t('saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  // Pre-computed label lookups (explicit keys — no template literal casting needed)
  const featureLabel: Record<FeatureKey, string> = {
    reservations: t('features.reservations'),
    unlimitedBookings: t('features.unlimitedBookings'),
    takeaway: t('features.takeaway'),
    qrOrdering: t('features.qrOrdering'),
    emailConfirmations: t('features.emailConfirmations'),
    whatsappReminders: t('features.whatsappReminders'),
    prioritySupport: t('features.prioritySupport'),
  };

  const tierName: Record<SubscriptionTier, string> = {
    starter: t('tiers.starter.name'),
    plus: t('tiers.plus.name'),
    premium: t('tiers.premium.name'),
  };

  const tierTagline: Record<SubscriptionTier, string> = {
    starter: t('tiers.starter.tagline'),
    plus: t('tiers.plus.tagline'),
    premium: t('tiers.premium.tagline'),
  };

  // ---- Visibility predicates ------------------------------------------------

  // Only show sub-picker when Premium tier selected + QR ordering enabled + plan exists
  const showQrPlanPicker =
    selectedTier === 'premium' &&
    qrOrderingEnabled === true &&
    qrPlan !== null;

  // ---- Transition strings ---------------------------------------------------

  const fullTransition =
    'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms ease-out';
  const reducedTransition =
    'box-shadow 120ms ease-out, border-color 120ms ease-out';

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      heading={t('title')}
      subHeading={t('description')}
      backHref={backHref}
      canContinue={selectedTier !== null && !isSaving}
      continueLabel={t('continue')}
      onContinue={() => void handleContinue()}
      isSubmitting={isSaving}
      error={saveError}
      onDismissError={() => setSaveError(null)}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      {/* Focus rings + mobile reset for the elevated Premium card */}
      <style>{`
        [data-tier-card]:focus-visible {
          outline: 2px solid #d4820a;
          outline-offset: 4px;
        }
        [data-qr-plan-card]:focus-visible {
          outline: 2px solid #d4820a;
          outline-offset: 3px;
        }
        @media (max-width: 767px) {
          [data-premium-card] {
            transform: translateY(0) !important;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ---- Tier cards ------------------------------------------------- */}
        <div
          role="radiogroup"
          aria-label={t('title')}
          className="grid gap-5 md:grid-cols-3"
          style={{ paddingTop: '32px' }}
        >
          {TIERS.map((tier) => {
            const isSelected = selectedTier === tier;
            const isHovered = hoveredTier === tier && !isSelected;
            const isPremium = tier === 'premium';

            // ---- Card style -----------------------------------------------

            let transform = 'translateY(0)';
            if (!prefersReducedMotion) {
              if (isPremium) {
                transform = isSelected || isHovered ? 'translateY(-16px)' : 'translateY(-12px)';
              } else {
                transform = isSelected || isHovered ? 'translateY(-4px)' : 'translateY(0)';
              }
            }

            let boxShadow: string;
            if (isPremium) {
              if (isSelected) {
                boxShadow =
                  '0 0 0 4px rgba(253, 250, 245, 0.55), 0 0 0 7px rgba(212, 130, 10, 0.45), 0 22px 48px -18px rgba(212, 130, 10, 0.55)';
              } else if (isHovered) {
                boxShadow =
                  '0 22px 48px -18px rgba(212, 130, 10, 0.55), 0 8px 16px -8px rgba(30, 21, 8, 0.22)';
              } else {
                boxShadow =
                  '0 18px 40px -16px rgba(212, 130, 10, 0.45), 0 6px 12px -6px rgba(30, 21, 8, 0.18)';
              }
            } else {
              if (isSelected) {
                boxShadow =
                  '0 0 0 4px rgba(212, 130, 10, 0.12), 0 14px 32px -14px rgba(212, 130, 10, 0.30)';
              } else if (isHovered) {
                boxShadow =
                  '0 12px 28px -12px rgba(30, 21, 8, 0.18), 0 4px 8px -4px rgba(30, 21, 8, 0.08)';
              } else {
                boxShadow = '0 1px 2px rgba(30, 21, 8, 0.04)';
              }
            }

            const border = isPremium
              ? '1px solid #b86d00'
              : isSelected
              ? '2px solid #d4820a'
              : isHovered
              ? '1px solid rgba(30, 21, 8, 0.20)'
              : '1px solid rgba(30, 21, 8, 0.10)';

            const background = isPremium
              ? '#d4820a'
              : isSelected
              ? '#fdf4e6'
              : '#f8f2e6';

            const nameColor = isPremium ? '#fdfaf5' : '#1e1508';
            const taglineColor = isPremium ? 'rgba(253, 250, 245, 0.80)' : '#9c8b6a';
            const dividerColor = isPremium
              ? 'rgba(253, 250, 245, 0.20)'
              : 'rgba(30, 21, 8, 0.08)';
            const pillBg = isPremium ? '#fdfaf5' : '#d4820a';
            const pillTextColor = isPremium ? '#d4820a' : '#fdfaf5';

            return (
              <div
                key={tier}
                data-tier-card
                {...(isPremium ? { 'data-premium-card': '' } : {})}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => handleSelectTier(tier)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectTier(tier);
                  }
                }}
                onMouseEnter={() => setHoveredTier(tier)}
                onMouseLeave={() => setHoveredTier(null)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '28px 24px 24px',
                  borderRadius: '16px',
                  border,
                  background,
                  boxShadow,
                  transform,
                  transition: prefersReducedMotion ? reducedTransition : fullTransition,
                  cursor: 'pointer',
                  outline: 'none',
                  userSelect: 'none',
                }}
              >
                {/* Recommended badge (Premium only) */}
                {isPremium && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-14px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#1e1508',
                      color: '#d4820a',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 700,
                      fontSize: '11px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px -4px rgba(30, 21, 8, 0.30)',
                    }}
                  >
                    {t('recommended')}
                  </div>
                )}

                {/* Header: name + tagline LEFT | price pill RIGHT */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '20px',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                      fontWeight: 900,
                      fontSize: '26px',
                      color: nameColor,
                      lineHeight: 1.15,
                      marginBottom: '4px',
                    }}>
                      {tierName[tier]}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 400,
                      fontSize: '13px',
                      color: taglineColor,
                      lineHeight: 1.4,
                    }}>
                      {tierTagline[tier]}
                    </div>
                  </div>

                  {/* Price pill */}
                  <div style={{
                    background: pillBg,
                    borderRadius: '999px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                      fontWeight: 900,
                      fontSize: '22px',
                      color: pillTextColor,
                      lineHeight: 1.1,
                    }}>
                      {formatEuros(TIER_MONTHLY_CENTS[tier], locale)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 500,
                      fontSize: '10px',
                      color: pillTextColor,
                      opacity: 0.85,
                      lineHeight: 1.2,
                    }}>
                      {t('perMonth')}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: dividerColor, margin: '0 0 16px' }} />

                {/* Feature rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {FEATURE_ORDER.map((featureKey) => {
                    const included = TIER_FEATURES[tier][featureKey];

                    const iconColor = isPremium
                      ? included ? '#fdfaf5' : 'rgba(253, 250, 245, 0.45)'
                      : included ? '#d4820a' : '#c9b896';

                    const labelColor = isPremium
                      ? included ? '#fdfaf5' : 'rgba(253, 250, 245, 0.55)'
                      : included ? '#1e1508' : '#9c8b6a';

                    const srText = included
                      ? (locale === 'nl' ? 'Inbegrepen' : 'Included')
                      : (locale === 'nl' ? 'Niet inbegrepen' : 'Not included');

                    return (
                      <div
                        key={featureKey}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          color: iconColor,
                        }}>
                          {included ? <CheckIcon /> : <XIcon />}
                        </div>
                        <span style={srOnlyStyle}>{srText} —</span>
                        <span style={{
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontSize: '14px',
                          color: labelColor,
                          textDecoration: included ? 'none' : 'line-through',
                          lineHeight: 1.4,
                        }}>
                          {featureLabel[featureKey]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- QR-pakket sub-picker (Premium tier + QR ordering enabled) --- */}
        {showQrPlanPicker && (
          <div style={{
            background: '#f8f2e6',
            border: '1px solid rgba(30, 21, 8, 0.10)',
            borderRadius: '12px',
            padding: '20px 24px',
          }}>
            {/* Heading row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#9c8b6a',
              }}>
                {t('qrPlanPicker.label')}
              </span>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 400,
                fontSize: '13px',
                color: '#9c8b6a',
              }}>
                {t('qrPlanPicker.hint')}
              </span>
            </div>

            {/* Two compact plan cards */}
            <div
              role="radiogroup"
              aria-label={t('qrPlanPicker.label')}
              className="grid gap-3 sm:grid-cols-2"
            >
              {QR_PLANS.map((plan) => {
                const isPlanSelected = qrPlan === plan;
                const isPlanHovered = hoveredQrPlan === plan && !isPlanSelected;

                return (
                  <div
                    key={plan}
                    data-qr-plan-card
                    role="radio"
                    aria-checked={isPlanSelected}
                    tabIndex={0}
                    onClick={() => handleSelectQrPlan(plan)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectQrPlan(plan);
                      }
                    }}
                    onMouseEnter={() => setHoveredQrPlan(plan)}
                    onMouseLeave={() => setHoveredQrPlan(null)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: isPlanSelected ? '#fdf4e6' : '#fdfaf5',
                      border: isPlanSelected
                        ? '2px solid #d4820a'
                        : isPlanHovered
                        ? '1px solid rgba(30, 21, 8, 0.22)'
                        : '1px solid rgba(30, 21, 8, 0.12)',
                      cursor: 'pointer',
                      outline: 'none',
                      userSelect: 'none',
                      transition: 'border-color 120ms ease, background 120ms ease',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-jost), Jost, sans-serif',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: '#1e1508',
                      }}>
                        {plan === 'basic'
                          ? t('qrPlanPicker.basic.name')
                          : t('qrPlanPicker.premium.name')}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-jost), Jost, sans-serif',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: '#d4820a',
                      }}>
                        {formatEuros(QR_SETUP_CENTS[plan], locale)}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 400,
                      fontSize: '12px',
                      color: '#9c8b6a',
                      lineHeight: 1.4,
                    }}>
                      {plan === 'basic'
                        ? t('qrPlanPicker.basic.description')
                        : t('qrPlanPicker.premium.description')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Downgrade notice ------------------------------------------- */}
        {showDowngradeNotice && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: '#fdf4e6',
              borderLeft: '3px solid #d4820a',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 400,
              fontSize: '13px',
              color: '#1e1508',
              lineHeight: 1.5,
            }}>
              {t('qrPlanPicker.downgradeNotice')}
            </span>
            <button
              type="button"
              onClick={() => setShowDowngradeNotice(false)}
              aria-label={t('qrPlanPicker.dismiss')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: '#9c8b6a',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <XIcon size={12} />
            </button>
          </div>
        )}

        {/* ---- Trial info ------------------------------------------------- */}
        {selectedTier && selectedTier !== 'starter' && (
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '14px',
            color: '#9c8b6a',
          }}>
            {t('trialInfo', { monthly: formatEuros(pricing.monthlyCents, locale) })}
          </div>
        )}

        {/* ---- One-time fees breakdown ------------------------------------ */}
        {qrPlan !== null ? (
          <div style={{
            padding: '24px',
            borderRadius: '12px',
            background: '#f8f2e6',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              color: '#1e1508',
              margin: '0 0 16px',
            }}>
              {t('oneTimeFees.heading')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '14px',
                  color: '#1e1508',
                }}>
                  {t(qrPlan === 'basic' ? 'oneTimeFees.qrSetupBasic' : 'oneTimeFees.qrSetupPremium')}
                </span>
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '14px',
                  color: '#1e1508',
                  fontWeight: 500,
                }}>
                  {formatEuros(pricing.qrSetupCents, locale)}
                </span>
              </div>

              {pricing.extraQrTableCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    color: '#1e1508',
                  }}>
                    {t('oneTimeFees.extraTables', { count: pricing.extraQrTableCount })}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    color: '#1e1508',
                    fontWeight: 500,
                  }}>
                    {formatEuros(pricing.extraQrTableCents, locale)}
                  </span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid rgba(30, 21, 8, 0.10)', margin: '12px 0' }} />

            {/* Subtotaal (net) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '14px',
                color: '#1e1508',
              }}>
                {t('oneTimeFees.subtotal')}
              </span>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '14px',
                color: '#1e1508',
                fontWeight: 500,
              }}>
                {formatEuros(pricing.totalDueTodayCents, locale)}
              </span>
            </div>

            {/* Total incl. VAT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '15px',
                fontWeight: 600,
                color: '#1e1508',
              }}>
                {t('oneTimeFees.totalDueToday')}
              </span>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                color: '#d4820a',
              }}>
                {formatEuros(applyVat(pricing.totalDueTodayCents).grossCents, locale)}
              </span>
            </div>
          </div>
        ) : (
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '14px',
            color: '#9c8b6a',
          }}>
            {t('oneTimeFees.noFees')}
          </div>
        )}

        {/* ---- VAT disclaimer --------------------------------------------- */}
        <div style={{
          marginTop: '28px',
          marginBottom: '4px',
          textAlign: 'center',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: '11px',
          letterSpacing: '0.01em',
          color: '#9c8b6a',
          lineHeight: 1.5,
        }}>
          {t('vatNotice')}
        </div>

      </div>
    </StepFrame>
  );
}
