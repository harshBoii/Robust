import { redirect } from 'next/navigation';

import HomeOverviewClient from '@/app/components/home/HomeOverviewClient';
import { getSession } from '@/lib/auth/session';

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <HomeOverviewClient displayName={session.userName} />;
}
