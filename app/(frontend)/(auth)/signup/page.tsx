'use client';

import { Suspense } from 'react';

import OnboardingWizard from '@/app/components/onboarding/OnboardingWizard';

function SignupFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Loading onboarding…
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <OnboardingWizard />
    </Suspense>
  );
}
