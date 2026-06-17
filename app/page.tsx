import { redirect } from 'next/navigation';

import { UNAUTHENTICATED_REDIRECT_PATH } from '@/lib/auth/constants';
import { getSession } from '@/lib/auth/session';

export default async function RootPage() {
  const session = await getSession();
  if (session) redirect('/home');
  redirect(UNAUTHENTICATED_REDIRECT_PATH);
}
