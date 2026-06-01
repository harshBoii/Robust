'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CHATS_INTENT_SUGGESTIONS } from '@/lib/chats/chat-path-suggestions';

import { setPendingChatStart } from './chat-pending-storage';
import { ChatsComposer } from './ChatsComposer';

const ease = [0.22, 1, 0.36, 1] as const;

export default function ChatsLanding({ userName }: { userName: string; companyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto">
      <motion.div
        className="w-full max-w-3xl px-4 py-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease }}
      >
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Back at it, {userName}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            What would you like to promote today?
          </p>
        </div>
        <ChatsComposer
          onSend={(t) => void startChat(t)}
          loading={loading}
          disabled={loading}
          placeholder="Write a message…"
          suggestions={[...CHATS_INTENT_SUGGESTIONS]}
        />
      </motion.div>
    </div>
  );
}
