'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import StepFrame from '@/components/onboarding/shell/StepFrame';
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator';
import { useDraftSave } from '@/lib/onboarding/useDraftSave';
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

// ---- Per-tier feature lists -------------------------------------------------

type FeatureItem = {
  key: string;
  isUpgradeHeader?: boolean;
};

const TIER_FEATURE_LISTS: Record<SubscriptionTier, FeatureItem[]> = {
  starter: [
    { key: 'reservationsLimited' },
    { key: 'widget' },
    { key: 'realtimeAvailability' },
    { key: 'emailConfirmations' },
    { key: 'multiLanguage' },
    { key: 'uptime' },
    { key: 'standardSupport' },
    { key: 'regularUpdates' },
  ],
  plus: [
    { key: 'everythingInStarter', isUpgradeHeader: true },
    { key: 'unlimitedReservations' },
    { key: 'takeaway' },
    { key: 'brandColors' },
    { key: 'analytics' },
    { key: 'customerDatabase' },
    { key: 'prioritySupport' },
    { key: 'setupCall' },
  ],
  premium: [
    { key: 'everythingInPlus', isUpgradeHeader: true },
    { key: 'qrOrdering' },
    { key: 'whatsapp' },
    { key: 'advancedAnalytics' },
    { key: 'vipGuests' },
    { key: 'customEmail' },
    { key: 'marketplaceBoost' },
    { key: 'dedicatedChannel' },
    { key: 'earlyAccess' },
  ],
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
      <path d="M3 7.2l2.6 2.6L11 4.4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round" />
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
  const { state: saveState, save } = useDraftSave();

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

  async function handleContinue() {
    if (!selectedTier) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/v1/restaurants/subscription/checkout?locale=${locale}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = (body as { error?: string })?.error || 'checkout_failed';
        setSaveError(t(`checkout.errors.${code}`));
        setIsSaving(false);
        return;
      }

      const data = (await res.json()) as {
        skipped?: boolean;
        nextStepUrl?: string;
        checkoutUrl?: string;
      };

      if (data.skipped && data.nextStepUrl) {
        router.refresh();
        router.push(data.nextStepUrl);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setSaveError(t('checkout.errors.checkout_failed'));
      setIsSaving(false);
    } catch {
      setSaveError(t('checkout.errors.network'));
      setIsSaving(false);
    }
  }

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

            // ---- Transform (Premium sits higher by default) ----------------

            let transform = 'translateY(0)';
            if (!prefersReducedMotion) {
              if (isPremium) {
                transform = isSelected || isHovered ? 'translateY(-16px)' : 'translateY(-12px)';
              } else {
                transform = isSelected || isHovered ? 'translateY(-4px)' : 'translateY(0)';
              }
            }

            // ---- Card style -----------------------------------------------

            const cardStyle: React.CSSProperties = {
              position: 'relative',
              padding: '36px 28px 32px',
              borderRadius: '20px',
              background: isPremium ? '#1a1610' : '#fdfaf5',
              border: isSelected
                ? '2px solid #d4820a'
                : isHovered
                ? `2px solid ${isPremium ? 'rgba(212, 130, 10, 0.5)' : 'rgba(212, 130, 10, 0.35)'}`
                : `2px solid ${isPremium ? 'rgba(253, 250, 245, 0.08)' : 'rgba(15, 13, 8, 0.08)'}`,
              boxShadow: isSelected
                ? '0 24px 48px -16px rgba(212, 130, 10, 0.35), 0 4px 12px rgba(15, 13, 8, 0.08)'
                : isHovered
                ? '0 20px 40px -16px rgba(15, 13, 8, 0.18)'
                : isPremium
                ? '0 12px 32px -12px rgba(15, 13, 8, 0.35)'
                : '0 4px 12px rgba(15, 13, 8, 0.06)',
              transform,
              transition: prefersReducedMotion ? reducedTransition : fullTransition,
              cursor: 'pointer',
              outline: 'none',
              userSelect: 'none',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
            };

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
                style={cardStyle}
              >
                {/* Recommended badge — Plus only */}
                {tier === 'plus' && (
                  <div style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#d4820a',
                    color: '#fdfaf5',
                    padding: '6px 16px',
                    borderRadius: '999px',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 600,
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    boxShadow: '0 4px 10px rgba(212, 130, 10, 0.35)',
                    whiteSpace: 'nowrap',
                  }}>
                    {t('recommendedBadge')}
                  </div>
                )}

                {/* Tier name eyebrow */}
                <div style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: isPremium ? 'rgba(253, 250, 245, 0.55)' : 'rgba(15, 13, 8, 0.5)',
                  marginBottom: '20px',
                }}>
                  {tierName[tier]}
                </div>

                {/* Price anchor */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                    fontWeight: 900,
                    fontSize: '56px',
                    lineHeight: 1,
                    color: isPremium ? '#d4820a' : '#0f0d08',
                    letterSpacing: '-0.02em',
                  }}>
                    {formatEuros(TIER_MONTHLY_CENTS[tier], locale)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 500,
                    fontSize: '13px',
                    color: isPremium ? 'rgba(253, 250, 245, 0.6)' : 'rgba(15, 13, 8, 0.55)',
                  }}>
                    / {t('perMonthShort')}
                  </span>
                </div>

                {/* Tagline */}
                <div style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: isPremium ? 'rgba(253, 250, 245, 0.7)' : 'rgba(15, 13, 8, 0.65)',
                  marginTop: '12px',
                  marginBottom: '24px',
                }}>
                  {tierTagline[tier]}
                </div>

                {/* Divider */}
                <div style={{
                  height: '1px',
                  background: isPremium ? 'rgba(253, 250, 245, 0.12)' : 'rgba(15, 13, 8, 0.1)',
                  marginBottom: '20px',
                }} />

                {/* Feature rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {TIER_FEATURE_LISTS[tier].map((feature) => {
                    if (feature.isUpgradeHeader) {
                      return (
                        <div
                          key={feature.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 14px',
                            background: isPremium
                              ? 'rgba(212, 130, 10, 0.16)'
                              : 'rgba(212, 130, 10, 0.1)',
                            border: `1px solid ${isPremium
                              ? 'rgba(212, 130, 10, 0.32)'
                              : 'rgba(212, 130, 10, 0.2)'}`,
                            borderRadius: '12px',
                            marginBottom: '8px',
                          }}
                        >
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '999px',
                            background: '#d4820a',
                            color: '#fdfaf5',
                            flexShrink: 0,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                              <path d="M6 2v8M2 6h8"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round" />
                            </svg>
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-jost), Jost, sans-serif',
                            fontWeight: 600,
                            fontSize: '13px',
                            letterSpacing: '0.04em',
                            color: isPremium ? '#fdfaf5' : '#0f0d08',
                            textTransform: 'uppercase',
                          }}>
                            {t(`features.${feature.key}`)}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={feature.key}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontSize: '14.5px',
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '999px',
                          background: isPremium
                            ? 'rgba(212, 130, 10, 0.18)'
                            : 'rgba(212, 130, 10, 0.14)',
                          color: '#d4820a',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}>
                          <CheckIcon />
                        </span>
                        <span style={{
                          fontWeight: 500,
                          color: isPremium ? '#fdfaf5' : '#0f0d08',
                          lineHeight: 1.5,
                        }}>
                          {t(`features.${feature.key}`)}
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
                fontSize: '16px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* ---- Trial info banner ------------------------------------------ */}
        <div style={{
          background: 'rgba(212, 130, 10, 0.08)',
          border: '1px solid rgba(212, 130, 10, 0.2)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '4px',
        }}>
          <span style={{
            display: 'inline-flex',
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            background: '#d4820a',
            color: '#fdfaf5',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1.5L7.4 4.5L10.5 5L8.25 7.25L8.8 10.4L6 9L3.2 10.4L3.75 7.25L1.5 5L4.6 4.5L6 1.5Z"
                    fill="currentColor"/>
            </svg>
          </span>
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: '#0f0d08',
            lineHeight: 1.5,
          }}>
            {t('trialInfo', { monthly: selectedTier ? formatEuros(TIER_MONTHLY_CENTS[selectedTier], locale) : '—' })}
          </span>
        </div>

        {/* ---- One-time fees breakdown ------------------------------------ */}
        {qrPlan !== null ? (
          <div style={{
            background: '#fdfaf5',
            border: '1px solid rgba(15, 13, 8, 0.08)',
            borderRadius: '16px',
            padding: '24px',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
              fontSize: '20px',
              color: '#0f0d08',
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

            <div style={{ borderTop: '1px solid rgba(15, 13, 8, 0.1)', margin: '16px 0' }} />

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
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(15, 13, 8, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 600,
                fontSize: '15px',
                color: '#0f0d08',
              }}>
                {t('oneTimeFees.totalDueToday')}
              </span>
              <span style={{
                fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                fontWeight: 900,
                fontSize: '28px',
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
        <p style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: '12.5px',
          color: 'rgba(15, 13, 8, 0.55)',
          marginTop: '12px',
          textAlign: 'center',
        }}>
          {t('vatNotice')}
        </p>

      </div>
    </StepFrame>
  );
}
