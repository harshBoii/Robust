import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import PresetsClient from '@/app/components/manager/PresetsClient';

export default async function ManagerPresetsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <PresetsClient />;
}

