import { redirect } from 'next/navigation';

import ManagerSocialClient from '@/app/components/manager/ManagerSocialClient';
import { getSession } from '@/lib/auth/session';

export default async function ManagerSocialPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <ManagerSocialClient />;
}
