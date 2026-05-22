'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { TEMPLATE_CATALOG } from '@/lib/templates/catalog';
import { TEMPLATE_CATEGORIES, type TemplateCategory } from '@/lib/templates/types';

import { TemplateCard } from './TemplateCard';

export default function TemplatesClient() {
  const router = useRouter();
  const [category, setCategory] = useState<TemplateCategory | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    category === 'all'
      ? TEMPLATE_CATALOG
      : TEMPLATE_CATALOG.filter((t) => t.category === category);

  const onSelect = useCallback(
    async (templateId: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/chats/from-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ templateId }),
        });
        const data = (await res.json()) as { sessionId?: string; error?: string };
        if (!res.ok || !data.sessionId) {
          throw new Error(data.error ?? 'Could not start template');
        }
        router.push(`/chats/${data.sessionId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setBusy(false);
      }
    },
    [router],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/20 px-4 py-4">
        <h1 className="font-display text-xl font-semibold text-foreground">Templates</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
          Pick a recipe to start a guided image session — collect inputs in chat, generate with your
          chosen artist, iterate, or post to ads.
        </p>
      </header>

      <div className="flex shrink-0 flex-wrap gap-2 border-b border-border/20 px-4 py-3">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`rounded-full px-3 py-1 text-[12px] font-medium ${
            category === 'all'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/50'
          }`}
        >
          All
        </button>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium ${
              category === c.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} onSelect={onSelect} disabled={busy} />
          ))}
        </div>
      </div>
    </div>
  );
}
