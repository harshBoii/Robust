import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

import ChatsLanding from '@/app/components/chats/ChatsLanding';

export default async function ChatsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <ChatsLanding userName={session.userName ?? 'there'} companyId={session.companyId} />;
}
