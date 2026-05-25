import { redirect } from 'next/navigation';

import DataMinePageClient from '@/app/components/profile/DataMinePageClient';
import { getSession } from '@/lib/auth/session';

export default async function ProfileDataPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="-m-3 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f7f8] p-2 sm:-m-4 sm:p-3 md:-m-5 md:p-3">
      <DataMinePageClient />
    </div>
  );
}
