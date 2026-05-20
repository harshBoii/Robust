import { redirect } from 'next/navigation';

import DashboardClient from '@/app/components/dashboard/DashboardClient';
import { getSession } from '@/lib/auth/session';

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <DashboardClient />;
}
