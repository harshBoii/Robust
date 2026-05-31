import { redirect } from 'next/navigation';

import IntegrationPageClient from '@/app/components/profile/IntegrationPageClient';
import { getSession } from '@/lib/auth/session';

export default async function ProfileIntegrationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="-m-3 flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f7f8] p-2 sm:-m-4 sm:p-3 md:-m-5 md:p-3">
      <IntegrationPageClient />
    </div>
  );
}
