import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import RivalAnalysisClient from '@/app/components/rival-analysis/RivalAnalysisClient';

export default async function RivalAnalysisPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <RivalAnalysisClient />;
}
