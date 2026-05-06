import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import HistoryClient from '@/app/components/manager/HistoryClient';

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <HistoryClient />;
}

