import { ChatsRouteTransition } from '@/app/components/chats/ChatsRouteTransition';

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatsRouteTransition>{children}</ChatsRouteTransition>
    </div>
  );
}
