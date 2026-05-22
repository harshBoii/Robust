import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

import TemplatesClient from '@/app/components/templates/TemplatesClient';

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <TemplatesClient />;
}
