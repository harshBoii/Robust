'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type ChatSummary = {
  id: string;
  title: string;
  status: string;
  currentStep: string;
  updatedAt: string;
};

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export default function ChatsHistoryList() {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', { credentials: 'include' });
      const data = (await res.json()) as { sessions?: ChatSummary[] };
      if (res.ok) setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener('robust-chats-refresh', onRefresh);
    return () => window.removeEventListener('robust-chats-refresh', onRefresh);
  }, [load]);

  const activeId = pathname?.match(/^\/chats\/([^/]+)/)?.[1];

  if (loading) {
    return <p className="px-3 py-2 text-[11px] text-muted-foreground/50">Loading…</p>;
  }

  if (sessions.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-[10px] leading-snug text-muted-foreground/40">
        No chats yet
      </p>
    );
  }

  return (
    <div className="custom-scrollbar max-h-[min(50vh,400px)] space-y-0.5 overflow-y-auto px-1">
      {sessions.map((s) => {
        const isActive = activeId === s.id;
        return (
          <Link
            key={s.id}
            href={`/chats/${s.id}`}
            className={[
              'block rounded-lg px-3 py-2 text-left transition-colors',
              isActive
                ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-primary'
                : 'text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground',
            ].join(' ')}
          >
            <p className="truncate text-[12px] font-medium">{s.title}</p>
            <p className="mt-0.5 text-[10px] opacity-60">{formatRelative(s.updatedAt)}</p>
          </Link>
        );
      })}
    </div>
  );
}
