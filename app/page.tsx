import { redirect } from 'next/navigation';

import { UNAUTHENTICATED_REDIRECT_PATH } from '@/lib/auth/constants';
import { getSession } from '@/lib/auth/session';
import { resolveLandingPath } from '@/lib/nav/landing-path';

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect(await resolveLandingPath(session.companyId));
  redirect(UNAUTHENTICATED_REDIRECT_PATH);
}
