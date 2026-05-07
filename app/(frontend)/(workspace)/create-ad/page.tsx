import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import CreateAdWizard from '@/app/components/createAd/CreateAdWizard';

export default async function CreateAdPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <CreateAdWizard companyId={session.companyId} />;
}

