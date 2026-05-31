import { redirect } from 'next/navigation';

import IntegrationPageClient from '@/app/components/profile/IntegrationPageClient';
import { profilePageShell } from '@/app/components/profile/profile-utils';
import { getSession } from '@/lib/auth/session';

export default async function ProfileIntegrationPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className={profilePageShell}>
      <IntegrationPageClient />
    </div>
  );
}
