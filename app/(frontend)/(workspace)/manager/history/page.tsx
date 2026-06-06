import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import HistoryClient from '@/app/components/manager/HistoryClient';

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const platform = params.platform as 'META' | 'GOOGLE' | undefined;

  return <HistoryClient initialPlatform={platform} />;
}

