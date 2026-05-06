import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import PostToMetaClient from '@/app/components/manager/PostToMetaClient';

export default async function PostToMetaPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <PostToMetaClient />;
}

