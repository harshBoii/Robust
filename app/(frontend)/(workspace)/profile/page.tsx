import { redirect } from 'next/navigation';

import ProfileClient from '@/app/components/profile/ProfileClient';
import { getSession } from '@/lib/auth/session';
import { getCompanyProfile } from '@/lib/profile/company-profile';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const profile = await getCompanyProfile(session.companyId);
  if (!profile) redirect('/login');

  return <ProfileClient profile={profile} />;
}
