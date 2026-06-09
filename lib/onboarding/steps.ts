import type { Database } from '@/packages/db/types';

export type Service = 'reservations' | 'takeaway' | 'qr';

export type StepDescriptor = {
  /** 1-indexed canonical step number from PRD §2.2. Step 0 is the service picker. */
  id: number;
  /** Stable key for code references, never user-visible. */
  key: string;
  /** Dutch label shown in sidebar. */
  label_nl: string;
  /** English label shown in sidebar. */
  label_en: string;
  /** URL path (without locale prefix). */
  path: string;
  /** Services that cause this step to appear. Empty = always shown. */
  services: Service[];
};

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

export const ALL_STEPS: StepDescriptor[] = [
  {
    id: 0,
    key: 'services',
    label_nl: 'Diensten kiezen',
    label_en: 'Choose services',
    path: '/onboarding',
    services: [],
  },
  {
    id: 1,
    key: 'business',
    label_nl: 'Bedrijf verifiëren',
    label_en: 'Verify your business',
    path: '/onboarding/business',
    services: ['reservations', 'takeaway', 'qr'],
  },
  {
    id: 2,
    key: 'floor-plan',
    label_nl: 'Plattegrond',
    label_en: 'Floor plan',
    path: '/onboarding/floor-plan',
    services: ['reservations'],
  },
  {
    id: 3,
    key: 'hours',
    label_nl: 'Openingstijden',
    label_en: 'Opening hours',
    path: '/onboarding/hours',
    services: ['reservations', 'takeaway', 'qr'],
  },
  {
    id: 4,
    key: 'rules',
    label_nl: 'Reserveringsregels',
    label_en: 'Booking rules',
    path: '/onboarding/rules',
    services: ['reservations'],
  },
  {
    id: 5,
    key: 'no-shows',
    label_nl: 'No-show bescherming',
    label_en: 'No-show protection',
    path: '/onboarding/no-shows',
    services: ['reservations'],
  },
  {
    id: 6,
    key: 'guest-experience',
    label_nl: 'Gastervaring',
    label_en: 'Guest experience',
    path: '/onboarding/guests',
    services: ['reservations'],
  },
  {
    id: 7,
    key: 'ordering',
    label_nl: 'Online bestellen',
    label_en: 'Online ordering settings',
    path: '/onboarding/ordering',
    services: ['takeaway'],
  },
  {
    id: 8,
    key: 'menu',
    label_nl: 'Menu uploaden',
    label_en: 'Menu upload',
    path: '/onboarding/menu',
    services: ['takeaway', 'qr'],
  },
  {
    id: 9,
    key: 'qr-setup',
    label_nl: 'QR opzet',
    label_en: 'QR setup & plan',
    path: '/onboarding/qr-setup',
    services: ['qr'],
  },
  {
    id: 10,
    key: 'qr-codes',
    label_nl: 'QR codes',
    label_en: 'QR codes',
    path: '/onboarding/qr-codes',
    services: ['qr'],
  },
  {
    id: 11,
    key: 'payments',
    label_nl: 'Betalingen koppelen',
    label_en: 'Connect payments',
    path: '/onboarding/payments',
    services: ['reservations', 'takeaway', 'qr'],
  },
  {
    id: 12,
    key: 'subscription',
    label_nl: 'Abonnement',
    label_en: 'Subscription',
    path: '/onboarding/subscription',
    services: ['reservations', 'takeaway', 'qr'],
  },
  {
    id: 13,
    key: 'contract',
    label_nl: 'Contract & ondertekenen',
    label_en: 'Contract & e-sign',
    path: '/onboarding/contract',
    services: ['reservations', 'takeaway', 'qr'],
  },
  {
    id: 14,
    key: 'review',
    label_nl: 'Controleren & live gaan',
    label_en: 'Review & go live',
    path: '/onboarding/review',
    services: ['reservations', 'takeaway', 'qr'],
  },
];

export function getVisibleSteps(
  restaurant: Pick<
    Restaurant,
    | 'service_reservations_enabled'
    | 'service_takeaway_enabled'
    | 'service_qr_enabled'
  > | null
): StepDescriptor[] {
  if (!restaurant) {
    return ALL_STEPS.filter((s) => s.services.length === 0);
  }

  const enabled = new Set<Service>();
  if (restaurant.service_reservations_enabled) enabled.add('reservations');
  if (restaurant.service_takeaway_enabled) enabled.add('takeaway');
  if (restaurant.service_qr_enabled) enabled.add('qr');

  return ALL_STEPS.filter((s) => {
    if (s.services.length === 0) return true;
    return s.services.some((svc) => enabled.has(svc));
  });
}

export function getDisplayedStepNumber(
  canonicalId: number,
  visibleSteps: StepDescriptor[]
): number | null {
  const wizardSteps = visibleSteps.filter((s) => s.id > 0);
  const wizardIndex = wizardSteps.findIndex((s) => s.id === canonicalId);
  if (wizardIndex === -1) return null;
  return wizardIndex + 1;
}

export function getTotalWizardSteps(visibleSteps: StepDescriptor[]): number {
  return visibleSteps.filter((s) => s.id > 0).length;
}

export type StepStatus = 'completed' | 'current' | 'reachable' | 'unreachable';

/**
 * Derives the canonical step id from a URL pathname.
 * Uses exact-match first, then longest-prefix so /onboarding never
 * greedily absorbs /onboarding/floor-plan before step 2 gets a chance.
 * Strips the locale prefix (/en or /nl) before matching.
 * Exported so both the server shell and the client sidebar can share
 * one implementation.
 */
export function resolveStepIdFromPath(pathname: string): number | null {
  if (!pathname) return null

  let stripped = pathname.replace(/^\/(en|nl)(?=\/|$)/, '')
  if (stripped === '') stripped = '/'
  if (stripped.length > 1 && stripped.endsWith('/')) {
    stripped = stripped.slice(0, -1)
  }

  const exact = ALL_STEPS.find((s) => s.path === stripped)
  if (exact) return exact.id

  const prefixMatches = ALL_STEPS.filter((s) =>
    stripped.startsWith(s.path + '/')
  )
  if (prefixMatches.length === 0) return null
  prefixMatches.sort((a, b) => b.path.length - a.path.length)
  return prefixMatches[0]!.id
}

/**
 * Returns the effective "how far has the user progressed" value for sidebar
 * rendering. If the URL is ahead of the DB (e.g. webhook fired but DB hasn't
 * caught up yet), treat the URL step as the progress floor so previously-
 * completed steps still render as completed rather than muted/unreachable.
 */
export function getEffectiveCurrentStep(
  currentOnboardingStep: number,
  liveStepId: number | null
): number {
  if (liveStepId === null) return currentOnboardingStep
  return Math.max(currentOnboardingStep, liveStepId)
}

export function getStepStatus(
  stepId: number,
  currentOnboardingStep: number,
  currentRouteStepId: number | null
): StepStatus {
  if (currentRouteStepId !== null && stepId === currentRouteStepId) {
    return 'current';
  }
  if (stepId < currentOnboardingStep) return 'completed';
  if (stepId === currentOnboardingStep) return 'reachable';
  return 'unreachable';
}
