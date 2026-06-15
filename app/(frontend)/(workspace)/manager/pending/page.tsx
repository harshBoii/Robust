import { redirect } from 'next/navigation';

import PendingAdsClient from '@/app/components/manager/PendingAdsClient';
import { getSession } from '@/lib/auth/session';

export default async function ManagerPendingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <PendingAdsClient />;
}
