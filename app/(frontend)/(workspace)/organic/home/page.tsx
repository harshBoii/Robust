import { redirect } from 'next/navigation';

import HomeDashboard from '@/app/components/organic/home/HomeDashboard';
import { getSession } from '@/lib/auth/session';
import { loadOrganicHomeData } from '@/lib/organic/home/loadOrganicHomeData';

export default async function OrganicHomePage() {
  const session = await getSession();
  if (!session?.companyId) redirect('/login');

  const data = await loadOrganicHomeData(session.companyId);

  return (
    <HomeDashboard
      payload={data.payload}
      geoKnight={data.geoKnight}
      rivalsForCharts={data.rivalsForCharts}
      sparkSeries={data.sparkSeries}
      contextRows={data.contextRows}
      highlightPrompts={data.highlightPrompts}
      recentCitations={data.recentCitations}
    />
  );
}
