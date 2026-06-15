import { redirect } from 'next/navigation';

import MetaAdsAutoConfigClient from '@/app/components/profile/MetaAdsAutoConfigClient';
import { getSession } from '@/lib/auth/session';

export default async function ProfileAdsAutomationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <MetaAdsAutoConfigClient />;
}
