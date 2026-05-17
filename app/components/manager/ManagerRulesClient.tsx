'use client';

import { useCallback, useEffect, useState } from 'react';

import AutomationControls, {
  type AutomationRule,
} from '@/app/components/dashboard/AutomationControls';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function ManagerRulesClient() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const seeded = await json<{ rules: AutomationRule[] }>(
        await fetch('/api/dashboard/automation', { method: 'POST' }),
      );
      setRules(seeded.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const updateRule = useCallback(
    async (
      ruleType: AutomationRule['ruleType'],
      patch: { isEnabled?: boolean; threshold?: number | null },
    ) => {
      setRules((prev) =>
        prev.map((r) => (r.ruleType === ruleType ? { ...r, ...patch } : r)),
      );
      try {
        await json<{ rule: AutomationRule }>(
          await fetch(`/api/dashboard/automation/${ruleType}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          }),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update rule');
      }
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Auto-pause rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle automation rules and set thresholds for your ad account.
          </p>
        </div>
        <button className="glass-button px-3 py-2 text-sm" type="button" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
      </div>

      {error ? (
        <div className="glass-card border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <AutomationControls rules={rules} onUpdateRule={updateRule} />

      <div className="glass-card p-4">
        <h3 className="text-lg font-semibold">Config notes</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
          <li>CPI is modeled from installs (falls back to clicks when installs are missing).</li>
          <li>Hook rate uses 3-second video views divided by impressions (video ads only).</li>
          <li>Winner amplification always requires manual approval.</li>
        </ul>
      </div>
    </div>
  );
}