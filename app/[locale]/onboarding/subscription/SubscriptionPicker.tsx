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
  TRIAL_DAYS,
  type SubscriptionTier,
  type QrPlan,
  type PricingBreakdown,
} from '@/lib/pricing/subscription';

// ---- Per-tier feature lists -------------------------------------------------

type FeatureItem = { key: string; isUpgradeHeader?: boolean };

const TIER_FEATURE_LISTS: Record<SubscriptionTier, FeatureItem[]> = {
  starter: [
    { key: 'reservationsLimited' },
    { key: 'qrOrdering' },
    { key: 'takeaway' },
    { key: 'widget' },
    { key: 'emailConfirmations' },
    { key: 'multiLanguage' },
    { key: 'standardSupport' },
  ],
  plus: [
    { key: 'everythingInStarter', isUpgradeHeader: true },
    { key: 'unlimitedReservations' },
    { key: 'brandColors' },
    { key: 'analytics' },
    { key: 'customerDatabase' },
    { key: 'prioritySupport' },
    { key: 'setupCall' },
  ],
  premium: [
    { key: 'everythingInPlus', isUpgradeHeader: true },
    { key: 'whatsapp' },
    { key: 'premiumQrDesign' },
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

// ---- Tier colour config -----------------------------------------------------

type TierConfig = {
  accentColor: string;
  dark: boolean;
};

const TIER_CONFIG: Record<SubscriptionTier, TierConfig> = {
  starter: { accentColor: 'var(--color-burgundy-500, #8b3a2a)', dark: false },
  plus:    { accentColor: 'var(--color-amber-500, #d4820a)',    dark: false },
  premium: { accentColor: '#e8b250',                            dark: true  },
};

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
  qrOrderingEnabled: _qrOrderingEnabled,
  qrTableCount,
  initialPricing: _initialPricing,
  currentDisplayNum,
  totalSteps,
  backHref,
  visibleStepIds: _visibleStepIds,
}: Props) {
  const t = useTranslations('onboarding.subscription');
  const router = useRouter();
  const pathname = usePathname();
  const { state: saveState, save } = useDraftSave();

  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(initialTier);
  const [qrPlan, setQrPlan] = useState<QrPlan | null>(initialQrPlan);
  const [tableCount, setTableCount] = useState(qrTableCount);
  const [showDowngradeNotice, setShowDowngradeNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hoveredTier, setHoveredTier] = useState<SubscriptionTier | null>(null);
  const [hoveredQrPlan, setHoveredQrPlan] = useState<QrPlan | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

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

  const pricing = calculatePricing({ tier: selectedTier, qrPlan, qrTableCount: tableCount });
  const vatBreakdown = applyVat(pricing.totalDueTodayCents);
  const isQrUnlocked = selectedTier === 'premium';

  // ---- Handlers --------------------------------------------------------------

  function handleSelectTier(nextTier: SubscriptionTier) {
    setSelectedTier(nextTier);
    setShowDowngradeNotice(false);
    const patch: { subscription_tier: SubscriptionTier; qr_plan?: QrPlan | null } = {
      subscription_tier: nextTier,
    };
    if (nextTier !== 'premium' && qrPlan === 'premium') {
      patch.qr_plan = 'basic';
      setQrPlan('basic');
      setShowDowngradeNotice(true);
    }
    save({ restaurant: patch });
  }

  function handleSelectQrPlan(nextPlan: QrPlan) {
    if (!isQrUnlocked) {
      handleSelectTier('premium');
      return;
    }
    setQrPlan(nextPlan);
    save({ restaurant: { qr_plan: nextPlan } });
  }

  function handleTableStep(delta: number) {
    if (!isQrUnlocked) return;
    setTableCount((c) => Math.max(0, Math.min(200, c + delta)));
  }

  async function handleContinue() {
    if (!selectedTier) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/v1/restaurants/subscription/checkout?locale=${locale}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code = (body as { error?: string })?.error || 'checkout_failed';
        setSaveError(t(`checkout.errors.${code}`));
        setIsSaving(false);
        return;
      }
      const data = (await res.json()) as { skipped?: boolean; nextStepUrl?: string; checkoutUrl?: string };
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
    plus:    t('tiers.plus.name'),
    premium: t('tiers.premium.name'),
  };
  const tierCourseLabel: Record<SubscriptionTier, string> = {
    starter: t('tiers.starter.courseLabel'),
    plus:    t('tiers.plus.courseLabel'),
    premium: t('tiers.premium.courseLabel'),
  };
  const tierTagline: Record<SubscriptionTier, string> = {
    starter: t('tiers.starter.tagline'),
    plus:    t('tiers.plus.tagline'),
    premium: t('tiers.premium.tagline'),
  };
  const qrPlanName: Record<QrPlan, string> = {
    basic:   t('qrPlanPicker.basic.name'),
    premium: t('qrPlanPicker.premium.name'),
  };

  // Footer summary text
  let footerSummary = '';
  if (selectedTier) {
    if (selectedTier === 'premium' && qrPlan) {
      footerSummary = t('footerSummaryPremiumQr', { planName: tierName.premium, qrName: qrPlanName[qrPlan], tables: tableCount });
    } else if (selectedTier === 'premium') {
      footerSummary = t('footerSummaryPremium', { planName: tierName.premium });
    } else {
      footerSummary = t('footerSummaryDefault', { planName: tierName[selectedTier] });
    }
  }

  const renderTierCard = (tier: SubscriptionTier) => {
    const cfg = TIER_CONFIG[tier];
    const isSelected = selectedTier === tier;
    const isHovered = hoveredTier === tier && !isSelected;
    const isPremium = tier === 'premium';

    let transform = 'translateY(0)';
    if (!prefersReducedMotion && (isSelected || isHovered)) {
      transform = 'translateY(-3px)';
    }

    const cardBg = isPremium ? '#1e1508' : (isSelected ? '#fffdf6' : 'var(--color-cream-100,#fbf6ec)');
    const cardBorder = isPremium
      ? isSelected ? `2px solid ${cfg.accentColor}` : '1.5px solid #6e5836'
      : isSelected ? `2px solid ${cfg.accentColor}` : '1.5px solid #e6d4ac';
    const cardShadow = isPremium
      ? isSelected
        ? '0 20px 46px rgba(40,30,10,0.4), 0 0 0 5px rgba(232,178,80,0.14)'
        : '0 10px 26px rgba(40,30,10,0.26)'
      : isSelected
        ? '0 14px 32px rgba(40,30,10,0.12)'
        : '0 1px 2px rgba(40,30,10,0.04)';

    const radioActiveBg = cfg.accentColor;
    const featureTextColor = isPremium ? '#e5dac4' : '#4a4031';
    const featureCheckColor = cfg.accentColor;
    const planNameColor = isPremium ? '#f5ecd8' : '#1e1508';
    const priceColor = isPremium ? '#e8b250' : '#1e1508';
    const perMonthColor = isPremium ? '#a99877' : 'var(--color-stone-400,#b0a080)';
    const taglineColor = isPremium ? '#b8a88f' : 'var(--color-stone-500,#9c8b6a)';
    const dotLeaderColor = isPremium ? 'rgba(232,178,80,0.4)' : '#d8c49a';

    return (
      <div
        key={tier}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        onClick={() => handleSelectTier(tier)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectTier(tier); } }}
        onMouseEnter={() => setHoveredTier(tier)}
        onMouseLeave={() => setHoveredTier(null)}
        style={{
          position: 'relative',
          background: cardBg,
          border: cardBorder,
          borderRadius: 14,
          padding: '26px 22px',
          cursor: 'pointer',
          boxShadow: cardShadow,
          transform,
          transition: prefersReducedMotion ? 'box-shadow 120ms' : 'transform 200ms ease, box-shadow 200ms ease, border-color 160ms ease',
          outline: 'none',
          userSelect: 'none',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Chef's selection badge — Premium only */}
        {isPremium && (
          <div style={{
            position: 'absolute',
            top: -13,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            padding: '6px 16px',
            borderRadius: 9999,
            background: 'var(--color-amber-500,#d4820a)',
            border: '1px solid var(--color-amber-700,#8a5208)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 16px rgba(212,130,10,0.4)',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 800,
            fontSize: 10.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: '#3a2a0e',
          }}>
            {t('badge')}
          </div>
        )}

        {/* Top row: course label + radio */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: cfg.accentColor,
          }}>
            {tierCourseLabel[tier]}
          </span>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 9999,
            background: isSelected ? radioActiveBg : 'transparent',
            border: isSelected ? `2px solid ${radioActiveBg}` : `2px solid ${isPremium ? '#6e5836' : '#d9cdb6'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.25s ease',
            flexShrink: 0,
          }}>
            {isSelected && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 13l4 4L19 7" stroke={isPremium ? '#1e1508' : 'white'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>

        {/* Plan name */}
        <div style={{
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: 30,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: planNameColor,
          marginBottom: 12,
        }}>
          {tierName[tier]}
        </div>

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: 38,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            color: priceColor,
          }}>
            {formatEuros(TIER_MONTHLY_CENTS[tier], locale)}
          </span>
          <div style={{ flex: 1, borderBottom: `1.5px dotted ${dotLeaderColor}`, transform: 'translateY(-5px)' }} />
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            color: perMonthColor,
            whiteSpace: 'nowrap',
          }}>
            / {t('perMonthShort')}
          </span>
        </div>

        {/* Tagline */}
        <p style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontStyle: 'italic',
          fontSize: 13.5,
          lineHeight: 1.45,
          color: taglineColor,
          margin: '0 0 16px',
        }}>
          {tierTagline[tier]}
        </p>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {TIER_FEATURE_LISTS[tier].map((feature) => {
            if (feature.isUpgradeHeader) {
              return (
                <div
                  key={feature.key}
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 700,
                    fontSize: 12,
                    color: isPremium ? '#e0b86a' : 'var(--color-amber-700,#8a5208)',
                    marginBottom: 11,
                    paddingBottom: 11,
                    borderBottom: `1px solid ${isPremium ? '#4a3e2e' : '#eadbb8'}`,
                  }}
                >
                  {t(`features.${feature.key}`)}, plus
                </div>
              );
            }
            return (
              <div
                key={feature.key}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, marginTop: 2, color: featureCheckColor }}>
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 400,
                  fontSize: 13.5,
                  lineHeight: 1.4,
                  color: featureTextColor,
                }}>
                  {t(`features.${feature.key}`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <StepFrame
      locale={locale}
      hideDefaultHeader
      showProgress={false}
      heading={t('title')}
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      backHref={backHref}
      canContinue={selectedTier !== null && !isSaving}
      continueLabel={t('confirmContinue')}
      onContinue={() => void handleContinue()}
      isSubmitting={isSaving}
      error={saveError}
      onDismissError={() => setSaveError(null)}
      savedIndicator={
        footerSummary ? (
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            color: '#7a6f5c',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 260,
            display: 'block',
          }}>
            {footerSummary}
          </span>
        ) : (
          <SavedIndicator state={saveState} locale={locale} />
        )
      }
    >
      <style>{`
        .sub-cards-outer { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; align-items: start; }
        .sub-cards-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: stretch; }
        .sub-qr-cards   { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sub-compliments-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; }
        @media (max-width: 768px) {
          .sub-cards-outer { grid-template-columns: 1fr !important; }
          .sub-cards-inner { grid-template-columns: 1fr !important; }
          .sub-qr-cards   { grid-template-columns: 1fr !important; }
          .sub-menu-inner { padding: 28px 22px 32px !important; }
          .sub-title      { font-size: 42px !important; }
          .sub-addition   { padding: 22px 20px 24px !important; }
          .sub-total-amount { font-size: 28px !important; }
          .sub-spotlight  { width: 440px !important; height: 320px !important; top: -120px !important; }
        }
      `}</style>

      {/* Outer page wrapper — relative so spotlight positions correctly */}
      <div style={{ position: 'relative', padding: '30px 0 80px' }}>

        {/* Spotlight glow */}
        <div
          className="sub-spotlight"
          style={{
            position: 'absolute',
            top: -160,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 800,
            height: 540,
            borderRadius: 9999,
            background: 'radial-gradient(ellipse at center, rgba(212,130,10,0.10), transparent 65%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Menu card */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 980,
          margin: '0 auto',
          background: 'var(--color-cream-100, #fbf6ec)',
          borderRadius: 6,
          boxShadow: '0 30px 70px rgba(40,30,10,0.18)',
          padding: 6,
        }}>
          <div
            className="sub-menu-inner"
            style={{
              border: '1px solid #e0c884',
              borderRadius: 4,
              padding: '48px 54px 52px',
            }}
          >

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: 0 }}>

              {/* Fork icon */}
              <div style={{
                width: 52,
                height: 52,
                border: '1.5px solid #c9a85f',
                borderRadius: 9999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 2v6c0 1.1.9 2 2 2h.5v12h1V10H9c1.1 0 2-.9 2-2V2h-1v5H8V2H7v5H6V2H5z" fill="none" stroke="var(--color-amber-700,#8a5208)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 2c-1.66 0-3 2.69-3 6h2v12h2V8h1c0-3.31-1.34-6-2-6z" fill="none" stroke="var(--color-amber-700,#8a5208)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Eyebrow */}
              <div style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: 'var(--color-amber-700, #8a5208)',
                marginBottom: 12,
              }}>
                {t('menuEyebrow')}
              </div>

              {/* Title */}
              <h1
                className="sub-title"
                style={{
                  fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                  fontWeight: 900,
                  fontSize: 58,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.95,
                  color: '#1e1508',
                  margin: '0 0 16px',
                }}
              >
                {t('title')}
              </h1>

              {/* Description */}
              <p style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 400,
                fontSize: 16.5,
                lineHeight: 1.55,
                color: 'var(--color-stone-500, #9c8b6a)',
                maxWidth: 560,
                margin: '0 auto',
              }}>
                {t('descriptionV2Prefix')}{' '}
                <strong style={{ color: 'var(--color-amber-700, #8a5208)', fontWeight: 700 }}>
                  {t('descriptionV2Strong', { trialDays: TRIAL_DAYS })}
                </strong>{' '}
                {t('descriptionV2Suffix', { chargeDay: TRIAL_DAYS + 1 })}
              </p>

              {/* Ornamental rule */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                margin: '26px auto 6px',
                maxWidth: 340,
              }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #d4c39c)' }} />
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 0l1.6 6.4L16 8l-6.4 1.6L8 16l-1.6-6.4L0 8l6.4-1.6z" fill="var(--color-amber-500,#d4820a)" />
                </svg>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #d4c39c, transparent)' }} />
              </div>
            </div>

            {/* ── Les Plats section label ──────────────────────────────────── */}
            <SectionLabel label={t('lesPlats')} />

            {/* ── Plan cards ───────────────────────────────────────────────── */}
            <div
              className="sub-cards-outer"
              role="radiogroup"
              aria-label={t('title')}
            >
              <div className="sub-cards-inner">
                {renderTierCard('starter')}
                {renderTierCard('plus')}
              </div>
              {renderTierCard('premium')}
            </div>

            {/* ── Compliments of the house ─────────────────────────────────── */}
            <SectionLabel label={t('complimentsLabel')} style={{ marginTop: 34 }} />

            <div className="sub-compliments-grid">
              {(['uptime', 'updates', 'gdpr', 'mobile'] as const).map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, color: 'var(--color-sage-500,#6e8b3d)' }}>
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 400,
                    fontSize: 14,
                    color: '#5a5043',
                  }}>
                    {t(`universal.${key}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── À la carte — QR codes ────────────────────────────────────── */}
            <div style={{ marginTop: 34, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#9a6b3f',
                  whiteSpace: 'nowrap',
                }}>
                  {t('qrSectionLabel')}
                </span>
                <div style={{ flex: 1, borderTop: '1.5px dotted #d8c49a' }} />
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  color: isQrUnlocked ? 'var(--color-sage-500,#6e8b3d)' : '#b0653f',
                  whiteSpace: 'nowrap',
                }}>
                  {isQrUnlocked ? t('qrUnlockedBadge') : t('qrLockedBadge')}
                </span>
              </div>
            </div>

            {/* QR options + tables stepper — with lock overlay when not Premium */}
            <div style={{ position: 'relative' }}>
              <div style={{
                opacity: isQrUnlocked ? 1 : 0.45,
                transition: 'opacity 0.25s ease',
              }}>
                {/* QR option cards */}
                <div
                  className="sub-qr-cards"
                  role="radiogroup"
                  aria-label={t('qrSectionLabel')}
                >
                  {QR_PLANS.map((plan) => {
                    const isPlanSelected = isQrUnlocked && qrPlan === plan;
                    const isPlanHovered = hoveredQrPlan === plan && !isPlanSelected && isQrUnlocked;

                    return (
                      <div
                        key={plan}
                        role="radio"
                        aria-checked={isPlanSelected}
                        tabIndex={isQrUnlocked ? 0 : -1}
                        onClick={() => handleSelectQrPlan(plan)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectQrPlan(plan); } }}
                        onMouseEnter={() => isQrUnlocked && setHoveredQrPlan(plan)}
                        onMouseLeave={() => setHoveredQrPlan(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 15,
                          padding: '18px 20px',
                          background: isPlanSelected ? '#fffdf6' : 'var(--color-cream-100,#fbf6ec)',
                          border: isPlanSelected ? '2px solid var(--color-amber-500,#d4820a)' : '1.5px solid #e6d4ac',
                          borderRadius: 14,
                          cursor: isQrUnlocked ? 'pointer' : 'default',
                          boxShadow: isPlanSelected ? '0 10px 24px rgba(40,30,10,0.1)' : 'none',
                          transform: isPlanHovered ? 'translateY(-2px)' : 'translateY(0)',
                          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                          outline: 'none',
                          userSelect: 'none',
                        }}
                      >
                        {/* Radio circle */}
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 9999,
                          flexShrink: 0,
                          background: isPlanSelected ? 'var(--color-amber-500,#d4820a)' : 'transparent',
                          border: isPlanSelected ? '2px solid var(--color-amber-500,#d4820a)' : '2px solid #d9cdb6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.25s ease',
                        }}>
                          {isPlanSelected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                            <span style={{
                              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                              fontWeight: 900,
                              fontSize: 18,
                              color: '#1e1508',
                            }}>
                              {plan === 'basic' ? t('qrPlanPicker.basic.name') : t('qrPlanPicker.premium.name')}
                            </span>
                            <div style={{ flex: 1, borderBottom: '1.5px dotted #d8c49a', transform: 'translateY(-4px)' }} />
                            <span style={{
                              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                              fontWeight: 900,
                              fontSize: 20,
                              color: 'var(--color-amber-700,#8a5208)',
                              whiteSpace: 'nowrap',
                            }}>
                              {formatEuros(QR_SETUP_CENTS[plan], locale)}
                            </span>
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-jost), Jost, sans-serif',
                            fontWeight: 400,
                            fontSize: 12.5,
                            color: 'var(--color-stone-400,#b0a080)',
                            marginTop: 3,
                          }}>
                            {plan === 'basic' ? t('qrPlanPicker.basic.description') : t('qrPlanPicker.premium.description')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tables stepper */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  background: '#f8f0df',
                  border: '1px solid #e7d6ae',
                  borderRadius: 14,
                  padding: '14px 18px',
                  marginTop: 14,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 700,
                      fontSize: 14,
                      color: '#1e1508',
                    }}>
                      {t('tablesLabel')}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 400,
                      fontSize: 12,
                      color: 'var(--color-stone-400,#b0a080)',
                      marginTop: 2,
                    }}>
                      {t('tablesHint')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StepperButton
                      label="−"
                      disabled={!isQrUnlocked || tableCount <= 0}
                      onClick={() => handleTableStep(-1)}
                    />
                    <div style={{
                      width: 54,
                      textAlign: 'center',
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                      fontWeight: 900,
                      fontSize: 24,
                      color: '#1e1508',
                      userSelect: 'none',
                    }}>
                      {tableCount}
                    </div>
                    <StepperButton
                      label="+"
                      disabled={!isQrUnlocked || tableCount >= 200}
                      onClick={() => handleTableStep(1)}
                    />
                  </div>
                </div>
              </div>

              {/* Lock overlay */}
              {!isQrUnlocked && (
                <div
                  onClick={() => handleSelectTier('premium')}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(251,245,231,0.55)',
                    backdropFilter: 'blur(1px)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                >
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    background: '#1e1508',
                    color: '#e8b250',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '11px 18px',
                    borderRadius: 9999,
                    boxShadow: '0 8px 22px rgba(40,30,10,0.3)',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="5" y="11" width="14" height="9" rx="2" stroke="#e8b250" strokeWidth="2"/>
                      <path d="M8 11V8a4 4 0 018 0v3" stroke="#e8b250" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    {t('qrLockCta')}
                  </div>
                </div>
              )}
            </div>

            {/* Downgrade notice */}
            {showDowngradeNotice && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: 14,
                  background: '#fdf4e6',
                  borderLeft: '3px solid #d4820a',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 400,
                  fontSize: 13,
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
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            )}

            {/* ── L'addition (bill) ────────────────────────────────────────── */}
            <div
              className="sub-addition"
              style={{
                marginTop: 36,
                background: '#1e1508',
                borderRadius: 16,
                padding: '30px 32px 32px',
                boxShadow: '0 18px 44px rgba(40,30,10,0.3)',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                  fontWeight: 900,
                  fontSize: 24,
                  letterSpacing: '-0.015em',
                  color: '#f4ead6',
                }}>
                  {t('additionHeading')}
                </span>
                <div style={{ flex: 1, borderTop: '1.5px dotted #5a4a35' }} />
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#a99877',
                }}>
                  {t('dueToday')}
                </span>
              </div>

              {/* Bill lines */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 18 }}>

                {/* Line 1: Subscription */}
                <BillLine
                  label={selectedTier ? t('billSubscriptionLabel', { planName: tierName[selectedTier] }) : t('billSubscriptionLabel', { planName: '—' })}
                  note={t('billTrialNote', { trialDays: TRIAL_DAYS })}
                  amount="€0"
                  amountSize={18}
                  amountColor="#8c7b5e"
                  leaderStyle="1px dotted #4a3e2e"
                />

                {/* Line 2: QR setup */}
                {isQrUnlocked && qrPlan && (
                  <BillLine
                    label={qrPlan === 'basic' ? t('oneTimeFees.qrSetupBasic') : t('oneTimeFees.qrSetupPremium')}
                    amount={formatEuros(pricing.qrSetupCents, locale)}
                    amountSize={18}
                    amountColor="#f4ead6"
                    leaderStyle="1px dotted #4a3e2e"
                  />
                )}

                {/* Line 3: Extra tables */}
                {isQrUnlocked && qrPlan && pricing.extraQrTableCount > 0 && (
                  <BillLine
                    label={t('oneTimeFees.extraTables', { count: pricing.extraQrTableCount })}
                    amount={formatEuros(pricing.extraQrTableCents, locale)}
                    amountSize={18}
                    amountColor="#f4ead6"
                    leaderStyle="1px dotted #4a3e2e"
                  />
                )}

                {/* Line 4: Subtotal */}
                {pricing.totalDueTodayCents > 0 && (
                  <BillLine
                    label={t('oneTimeFees.subtotal')}
                    amount={formatEuros(pricing.totalDueTodayCents, locale)}
                    labelSize={14}
                    labelColor="#a99877"
                    amountSize={17}
                    amountColor="#d8cbb2"
                    leaderStyle="1.5px solid #4a3e2e"
                  />
                )}

                {/* Line 5: VAT */}
                {pricing.totalDueTodayCents > 0 && (
                  <BillLine
                    label={t('vatLabel')}
                    amount={formatEuros(vatBreakdown.vatCents, locale)}
                    labelSize={14}
                    labelColor="#a99877"
                    amountSize={17}
                    amountColor="#d8cbb2"
                    leaderStyle="1px dotted #4a3e2e"
                  />
                )}

                {/* Line 6: Total today */}
                <BillLine
                  label={t('billTotalToday')}
                  note={pricing.totalDueTodayCents === 0 ? t('billOnTheHouse') : undefined}
                  amount={formatEuros(vatBreakdown.grossCents, locale)}
                  labelSize={19}
                  labelWeight={800}
                  labelColor="#f5ecd8"
                  amountClassName="sub-total-amount"
                  amountSize={34}
                  amountColor="#e8b250"
                  leaderStyle="1.5px solid #4a3e2e"
                />
              </div>

              {/* Fine print */}
              <p style={{
                margin: '20px 0 0',
                textAlign: 'center',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 400,
                fontSize: 12,
                color: '#8c7b5e',
              }}>
                {t('vatNotice')}
              </p>
            </div>

          </div>
        </div>
      </div>
    </StepFrame>
  );
}

// ---- Sub-components ---------------------------------------------------------

function SectionLabel({ label, style: extraStyle }: { label: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '30px 0 20px', ...extraStyle }}>
      <span style={{
        fontFamily: 'var(--font-raleway), Raleway, sans-serif',
        fontWeight: 900,
        fontSize: 14,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#9a6b3f',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, borderTop: '1.5px dotted #d8c49a' }} />
    </div>
  );
}

function StepperButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        border: '1.5px solid #e0c98e',
        background: 'var(--color-cream-100,#fbf6ec)',
        color: '#9a6b3f',
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 700,
        fontSize: 22,
        lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 150ms',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function BillLine({
  label,
  note,
  amount,
  labelSize = 15,
  labelWeight = 600,
  labelColor = '#d8cbb2',
  amountClassName,
  amountSize = 18,
  amountColor = '#f4ead6',
  leaderStyle = '1px dotted #4a3e2e',
}: {
  label: string;
  note?: string;
  amount: string;
  labelSize?: number;
  labelWeight?: number;
  labelColor?: string;
  amountClassName?: string;
  amountSize?: number;
  amountColor?: string;
  leaderStyle?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: labelWeight,
        fontSize: labelSize,
        color: labelColor,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {note && (
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontStyle: 'italic',
          fontSize: 11.5,
          color: '#8c7b5e',
          whiteSpace: 'nowrap',
        }}>
          {note}
        </span>
      )}
      <div style={{ flex: 1, borderBottom: leaderStyle, transform: 'translateY(-4px)' }} />
      <span
        className={amountClassName}
        style={{
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: amountSize,
          color: amountColor,
          whiteSpace: 'nowrap',
        }}
      >
        {amount}
      </span>
    </div>
  );
}
