import { redirect } from 'next/navigation';

import DataMinePageClient from '@/app/components/profile/DataMinePageClient';
import { profilePageShell } from '@/app/components/profile/profile-utils';
import { getSession } from '@/lib/auth/session';

export default async function ProfileDataPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className={profilePageShell}>
      <DataMinePageClient />
    </div>
  );
}
