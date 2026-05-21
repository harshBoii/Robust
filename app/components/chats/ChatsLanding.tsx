'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { setPendingChatStart } from './chat-pending-storage';
import { CHAT_COMPOSER_LAYOUT_ID } from './ChatsRouteTransition';
import { ChatsComposer } from './ChatsComposer';

const SUGGESTIONS = [
  'Post an ad',
  'Create product ad images',
  'Generate ad variants',
  'Product on model photoshoot',
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function ChatsLanding({ userName }: { userName: string; companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);

  async function startChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setExiting(true);
    try {
      const createRes = await fetch('/api/chats', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed.slice(0, 80) }),
      });
      const created = (await createRes.json()) as {
        session?: { id: string; title?: string };
      };
      if (!createRes.ok || !created.session?.id) throw new Error('Failed to create chat');

      setPendingChatStart({
        sessionId: created.session.id,
        text: trimmed,
        title: created.session.title ?? trimmed.slice(0, 80),
      });

      window.dispatchEvent(new CustomEvent('robust-chats-refresh'));
      router.push(`/chats/${created.session.id}`);
    } catch (e) {
      console.error(e);
      setExiting(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="flex h-full min-h-[calc(100vh-3rem)] flex-1 flex-col items-center justify-center"
      animate={exiting ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease }}
    >
      <motion.div
        className="w-full max-w-3xl px-4"
        animate={exiting ? { opacity: 0, scale: 0.98 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease }}
      >
        <motion.div
          className="mb-8 text-center"
          animate={exiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease }}
        >
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Back at it, {userName}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            What would you like to promote today?
          </p>
        </motion.div>
        <motion.div layoutId={CHAT_COMPOSER_LAYOUT_ID} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <ChatsComposer
            onSend={(t) => void startChat(t)}
            loading={loading}
            disabled={loading}
            placeholder="Write a message…"
            suggestions={SUGGESTIONS}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
