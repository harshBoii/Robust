import { ChatsRouteTransition } from '@/app/components/chats/ChatsRouteTransition';

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-3 flex h-full min-h-0 flex-1 flex-col overflow-hidden sm:-m-4 md:-m-5">
      <ChatsRouteTransition>{children}</ChatsRouteTransition>
    </div>
  );
}
