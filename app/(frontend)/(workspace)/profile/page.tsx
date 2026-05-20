import { redirect } from 'next/navigation';

import ProfileClient from '@/app/components/profile/ProfileClient';
import { getSession } from '@/lib/auth/session';
import { getCompanyProfile } from '@/lib/profile/company-profile';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const profile = await getCompanyProfile(session.companyId);
  if (!profile) redirect('/login');

  return (
    <div className="-m-3 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f7f8] p-2 sm:-m-4 sm:p-3 md:-m-5 md:p-3">
      <ProfileClient profile={profile} />
    </div>
  );
}
