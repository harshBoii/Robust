import { redirect } from 'next/navigation';

import ManagerMetaClient from '@/app/components/manager/ManagerMetaClient';
import { getSession } from '@/lib/auth/session';

export default async function ManagerMetaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <ManagerMetaClient />;
}
