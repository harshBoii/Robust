'use client';

import {
  ONBOARDING_PHASES,
  phaseForStep,
  phaseIndex,
  phaseProgress,
} from '@/lib/onboarding/phases';
import type { OnboardingStep } from '@/lib/onboarding/types';

export function OnboardingPhaseBar({ current }: { current: OnboardingStep }) {
  const activePhaseIdx = phaseIndex(current);
  const { stepInPhase, stepsInPhase } = phaseProgress(current);

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center gap-2">
        {ONBOARDING_PHASES.map((phase, i) => {
          const done = i < activePhaseIdx;
          const active = i === activePhaseIdx;
          const isLast = i === ONBOARDING_PHASES.length - 1;

          return (
            <li key={phase.id} className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all',
                      done && 'bg-primary text-primary-foreground',
                      active && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                      !done && !active && 'bg-muted text-muted-foreground',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={active ? 'step' : undefined}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={[
                        'truncate text-sm font-semibold',
                        active ? 'text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/70',
                      ].join(' ')}
                    >
                      {phase.label}
                    </p>
                    <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                      {phase.description}
                    </p>
                  </div>
                </div>
                {active && stepsInPhase > 1 ? (
                  <div className="ml-10 flex gap-1" aria-hidden>
                    {Array.from({ length: stepsInPhase }, (_, dot) => (
                      <div
                        key={dot}
                        className={[
                          'h-1 flex-1 rounded-full transition-colors',
                          dot <= stepInPhase ? 'bg-primary/70' : 'bg-border',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              {!isLast ? (
                <div
                  className={[
                    'hidden h-px w-4 shrink-0 sm:block',
                    done ? 'bg-primary/50' : 'bg-border',
                  ].join(' ')}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] text-muted-foreground sm:hidden">
        Phase {activePhaseIdx + 1} of {ONBOARDING_PHASES.length}:{' '}
        {ONBOARDING_PHASES[activePhaseIdx]?.label}
      </p>
    </nav>
  );
}

export function phaseLabelForStep(step: OnboardingStep): string {
  const id = phaseForStep(step);
  return ONBOARDING_PHASES.find((p) => p.id === id)?.label ?? 'Basics';
}
