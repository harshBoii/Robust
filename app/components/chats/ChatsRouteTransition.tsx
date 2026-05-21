'use client';

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const ease = [0.22, 1, 0.36, 1] as const;

export const CHAT_COMPOSER_LAYOUT_ID = 'chat-composer-shell';

export function ChatsRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/chats';

  return (
    <LayoutGroup id="chats">
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: isLanding ? 0.18 : 0.22, ease }}
          className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
  );
}
