import { redirect } from 'next/navigation';

import ManagerRulesClient from '@/app/components/manager/ManagerRulesClient';
import { getSession } from '@/lib/auth/session';

export default async function ManagerRulesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <ManagerRulesClient />;
}
