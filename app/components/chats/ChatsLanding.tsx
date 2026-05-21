'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ChatsComposer } from './ChatsComposer';

const SUGGESTIONS = [
  'Post an ad',
  'Create product ad images',
  'Generate ad variants',
  'Product on model photoshoot',
];

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
      const created = (await createRes.json()) as { session?: { id: string } };
      if (!createRes.ok || !created.session?.id) throw new Error('Failed to create chat');

      await fetch(`/api/chats/${created.session.id}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
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
    <div className="flex h-full min-h-[calc(100vh-3rem)] flex-col items-center justify-center">
      <div className="w-full max-w-3xl px-4">
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
          suggestions={SUGGESTIONS}
        />
      </div>
    </div>
  );
}
