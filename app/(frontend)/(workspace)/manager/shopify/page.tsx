import { redirect } from 'next/navigation';

import ManagerShopifyClient from '@/app/components/manager/ManagerShopifyClient';
import { getSession } from '@/lib/auth/session';

export default async function ManagerShopifyPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <ManagerShopifyClient />;
}
