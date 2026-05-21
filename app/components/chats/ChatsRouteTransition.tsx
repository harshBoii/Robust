'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const ease = [0.22, 1, 0.36, 1] as const;

/** @deprecated Shared layout morph removed — caused blank screen when returning to /chats */
export const CHAT_COMPOSER_LAYOUT_ID = 'chat-composer-shell';

export function ChatsRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease }}
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
