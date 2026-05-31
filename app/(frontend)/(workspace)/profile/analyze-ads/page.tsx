import { redirect } from 'next/navigation';

import AnalyzeAdsPageClient from '@/app/components/profile/AnalyzeAdsPageClient';
import { profilePageShell } from '@/app/components/profile/profile-utils';
import { getSession } from '@/lib/auth/session';

export default async function ProfileAnalyzeAdsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className={profilePageShell}>
      <AnalyzeAdsPageClient />
    </div>
  );
}
