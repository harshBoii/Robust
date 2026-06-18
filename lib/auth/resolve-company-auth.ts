import 'server-only';

import { getOnboardingSession } from '@/lib/auth/onboarding-session';
import { getSession } from '@/lib/auth/session';

export type CompanyAuthContext = {
  companyId: string;
  mode: 'auth' | 'onboarding';
};

export async function resolveCompanyAuthContext(): Promise<CompanyAuthContext | null> {
  const authSession = await getSession();
  if (authSession?.companyId) {
    return { companyId: authSession.companyId, mode: 'auth' };
  }

  const onboarding = await getOnboardingSession();
  if (onboarding?.companyId) {
    return { companyId: onboarding.companyId, mode: 'onboarding' };
  }

  return null;
}
