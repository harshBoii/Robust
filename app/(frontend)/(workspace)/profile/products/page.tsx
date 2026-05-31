import { redirect } from 'next/navigation';

import ProfileProductsPageClient from '@/app/components/profile/ProfileProductsPageClient';
import { profilePageShell } from '@/app/components/profile/profile-utils';
import { getSession } from '@/lib/auth/session';

export default async function ProfileProductsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className={profilePageShell}>
      <ProfileProductsPageClient />
    </div>
  );
}
