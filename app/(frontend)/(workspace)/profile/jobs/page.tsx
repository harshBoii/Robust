import { redirect } from 'next/navigation';

import ProfileJobsPageClient from '@/app/components/profile/ProfileJobsPageClient';
import { getSession } from '@/lib/auth/session';

export default async function ProfileJobsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <ProfileJobsPageClient />;
}
