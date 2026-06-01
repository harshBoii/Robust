'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type RedditPublishTargetChoice = {
  name: string;
  kind: 'profile' | 'subreddit';
  flairId?: string;
};

type RedditTargetDto = {
  kind: 'profile' | 'subreddit';
  name: string;
  label: string;
  title?: string | null;
  over18?: boolean;
};

type RedditFlairDto = {
  id: string;
  text: string;
};

function targetKey(t: RedditTargetDto) {
  return `${t.kind}:${t.name}`;
}

export type RedditPublishTargetPickerProps = {
  onConfirm: (choice: RedditPublishTargetChoice) => void;
  confirmLabel?: string;
  disabled?: boolean;
  /** Pre-select a subreddit/profile name if already chosen. */
  initialName?: string | null;
};

export function RedditPublishTargetPicker({
  onConfirm,
  confirmLabel = 'Use this community',
  disabled = false,
  initialName,
}: RedditPublishTargetPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<RedditTargetDto[]>([]);
  const [defaultSubreddit, setDefaultSubreddit] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [flairs, setFlairs] = useState<RedditFlairDto[]>([]);
  const [flairsLoading, setFlairsLoading] = useState(false);
  const [flairId, setFlairId] = useState('');

  const loadTargets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/reddit/publish-targets', {
        credentials: 'include',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? 'Failed to load subreddits');
      }
      const list = (json.data?.targets ?? []) as RedditTargetDto[];
      setTargets(list);
      setDefaultSubreddit(json.data?.defaultSubreddit ?? null);

      const initial =
        (initialName && list.find((t) => t.name === initialName)) ||
        list.find((t) => t.name === json.data?.defaultSubreddit) ||
        list.find((t) => t.kind === 'profile') ||
        list[0];
      setSelectedKey(initial ? targetKey(initial) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subreddits');
      setTargets([]);
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }, [initialName]);

  useEffect(() => {
    setFlairId('');
    setFlairs([]);
    void loadTargets();
  }, [loadTargets]);

  const selectedTarget = useMemo(
    () => targets.find((t) => targetKey(t) === selectedKey) ?? null,
    [targets, selectedKey],
  );

  useEffect(() => {
    if (!selectedTarget || selectedTarget.kind === 'profile') {
      setFlairs([]);
      setFlairId('');
      return;
    }

    let cancelled = false;
    setFlairsLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/integrations/reddit/flairs?subreddit=${encodeURIComponent(selectedTarget.name)}`,
          { credentials: 'include' },
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setFlairs([]);
          return;
        }
        setFlairs((json.data?.flairs ?? []) as RedditFlairDto[]);
        setFlairId('');
      } catch {
        if (!cancelled) setFlairs([]);
      } finally {
        if (!cancelled) setFlairsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedTarget]);

  const profileTargets = targets.filter((t) => t.kind === 'profile');
  const subredditTargets = targets.filter((t) => t.kind === 'subreddit');

  return (
    <div className="space-y-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)]/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Choose where to post on Reddit
      </p>

      {loading ? <p className="text-xs text-muted-foreground">Loading communities…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {!loading && !error && targets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No subreddits found. Connect Reddit under Profile → Integrations.
        </p>
      ) : null}

      {!loading && profileTargets.length > 0 ? (
        <div>
          <p className="mb-1.5 font-ui text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Your account
          </p>
          <ul className="space-y-1">
            {profileTargets.map((t) => {
              const key = targetKey(t);
              const checked = selectedKey === key;
              return (
                <li key={key}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      checked
                        ? 'border-[var(--sibling-primary)]/50 bg-[var(--sibling-primary)]/10'
                        : 'border-[var(--glass-border)] hover:border-[var(--sibling-primary)]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reddit-target-chat"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => setSelectedKey(key)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 flex-1 text-foreground">{t.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!loading && subredditTargets.length > 0 ? (
        <div>
          <p className="mb-1.5 font-ui text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Subreddits
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {subredditTargets.map((t) => {
              const key = targetKey(t);
              const checked = selectedKey === key;
              return (
                <li key={key}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      checked
                        ? 'border-[var(--sibling-primary)]/50 bg-[var(--sibling-primary)]/10'
                        : 'border-[var(--glass-border)] hover:border-[var(--sibling-primary)]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reddit-target-chat"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => setSelectedKey(key)}
                      disabled={disabled}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground">{t.label}</span>
                      {t.over18 ? (
                        <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                          NSFW
                        </span>
                      ) : null}
                      {defaultSubreddit === t.name ? (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">(default)</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {selectedTarget?.kind === 'subreddit' && !flairsLoading && flairs.length > 0 ? (
        <label className="block text-xs text-muted-foreground">
          <span className="mb-1 block font-medium text-foreground">Post flair (optional)</span>
          <select
            value={flairId}
            onChange={(e) => setFlairId(e.target.value)}
            disabled={disabled}
            className="w-full rounded-md border border-[var(--glass-border)] bg-[var(--glass)] px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">No flair</option>
            {flairs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.text}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {flairsLoading ? <p className="text-[10px] text-muted-foreground">Loading flairs…</p> : null}

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={disabled || !selectedTarget || Boolean(error) || loading}
          onClick={() => {
            if (!selectedTarget) return;
            onConfirm({
              name: selectedTarget.name,
              kind: selectedTarget.kind,
              ...(flairId ? { flairId } : {}),
            });
          }}
          className="glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
