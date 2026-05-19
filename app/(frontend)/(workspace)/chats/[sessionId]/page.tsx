import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

import ChatsClient from '@/app/components/chats/ChatsClient';

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { sessionId } = await params;
  return (
    <ChatsClient
      sessionId={sessionId}
      companyId={session.companyId}
      userName={session.userName ?? 'there'}
    />
  );
}
