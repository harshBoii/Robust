import type { OnboardingStep } from './types';

export const ONBOARDING_PHASES = [
  {
    id: 'basics',
    label: 'Basics',
    description: 'Name & domain',
    steps: ['welcome', 'company'] as const satisfies readonly OnboardingStep[],
  },
  {
    id: 'brand',
    label: 'Brand',
    description: 'Profile & DNA',
    steps: ['enriching', 'brand-basics', 'brand-audience'] as const satisfies readonly OnboardingStep[],
  },
  {
    id: 'channels',
    label: 'Channels',
    description: 'Connect & learn',
    steps: ['facebook', 'shopify', 'guide-ads', 'guide-aeo'] as const satisfies readonly OnboardingStep[],
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'Strategy & access',
    steps: ['your-plan', 'request-access', 'request-password', 'done'] as const satisfies readonly OnboardingStep[],
  },
] as const;

export type OnboardingPhaseId = (typeof ONBOARDING_PHASES)[number]['id'];

export function phaseForStep(step: OnboardingStep): OnboardingPhaseId {
  const normalized = step === 'request-password' ? 'request-access' : step;
  for (const phase of ONBOARDING_PHASES) {
    if ((phase.steps as readonly string[]).includes(normalized)) {
      return phase.id;
    }
  }
  return 'basics';
}

export function phaseIndex(step: OnboardingStep): number {
  return ONBOARDING_PHASES.findIndex((p) => p.id === phaseForStep(step));
}

export function phaseProgress(step: OnboardingStep): {
  phaseId: OnboardingPhaseId;
  phaseIndex: number;
  stepInPhase: number;
  stepsInPhase: number;
} {
  const phaseId = phaseForStep(step);
  const idx = ONBOARDING_PHASES.findIndex((p) => p.id === phaseId);
  const phase = ONBOARDING_PHASES[idx]!;
  const normalized = step === 'request-password' ? 'request-access' : step;
  const stepInPhase = Math.max(0, (phase.steps as readonly string[]).indexOf(normalized));
  return {
    phaseId,
    phaseIndex: idx,
    stepInPhase,
    stepsInPhase: phase.steps.length,
  };
}
