'use client';

import type { OnboardingStep } from '@/lib/onboarding/types';

const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  company: 'Company',
  enriching: 'Enrich',
  'brand-basics': 'Brand',
  'brand-audience': 'Audience',
  facebook: 'Facebook',
  shopify: 'Shopify',
  'guide-ads': 'Ads',
  'guide-aeo': 'AEO',
  'your-plan': 'Plan',
  'request-access': 'Account',
  'request-password': 'Password',
  done: 'Done',
};

const VISIBLE_STEPS: OnboardingStep[] = [
  'welcome',
  'company',
  'enriching',
  'brand-basics',
  'brand-audience',
  'facebook',
  'shopify',
  'guide-ads',
  'guide-aeo',
  'your-plan',
  'request-access',
  'done',
];

export function OnboardingStepBar({ current }: { current: OnboardingStep }) {
  const currentIdx = VISIBLE_STEPS.indexOf(
    current === 'request-password' ? 'request-access' : current,
  );

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center gap-0 overflow-x-auto pb-1">
        {VISIBLE_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const isLast = i === VISIBLE_STEPS.length - 1;
          return (
            <li key={step} className="flex flex-1 min-w-[3.5rem] items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                    done && 'bg-primary text-primary-foreground',
                    active && 'bg-primary/15 text-primary ring-1 ring-primary/40',
                    !done && !active && 'bg-muted text-muted-foreground',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  className={[
                    'hidden text-[10px] font-medium sm:block',
                    active ? 'text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {!isLast && (
                <div
                  className={[
                    'mx-1 h-px flex-1',
                    done ? 'bg-primary/40' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
