import { redirect } from 'next/navigation';

import ShopProductsClient from '@/app/components/shop/ShopProductsClient';
import { getSession } from '@/lib/auth/session';

export default async function ShopProductsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <ShopProductsClient />;
}
