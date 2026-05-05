'use client';

import { useCallback, useEffect, useState } from 'react';

import AutomationControls, {
  type AutomationRule,
} from '@/app/components/dashboard/AutomationControls';

type MetaIntegration = {
  id: string;
  companyId: string;
  adAccountId: string;
  fbPageId: string;
  contextBuiltAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function WorkspaceSettingsClient() {
  const [metaIntegration, setMetaIntegration] = useState<MetaIntegration | null>(null);
  const [hasSystemToken, setHasSystemToken] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);

  const [adAccounts, setAdAccounts] = useState<Array<{ id: string; name?: string }>>([]);
  const [pages, setPages] = useState<Array<{ id: string; name?: string }>>([]);

  const [adAccountId, setAdAccountId] = useState('');
  const [fbPageId, setFbPageId] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const meta = await json<{ metaIntegration: MetaIntegration | null; hasSystemToken: boolean }>(
        await fetch('/api/meta/integration'),
      );
      setMetaIntegration(meta.metaIntegration);
      setHasSystemToken(meta.hasSystemToken);
      setAdAccountId(meta.metaIntegration?.adAccountId ?? '');
      setFbPageId(meta.metaIntegration?.fbPageId ?? '');

      const seeded = await json<{ rules: AutomationRule[] }>(
        await fetch('/api/dashboard/automation', { method: 'POST' }),
      );
      setRules(seeded.rules);

      if (meta.hasSystemToken) {
        const [aa, pp] = await Promise.all([
          json<{ adAccounts: Array<{ id: string; name?: string }> }>(
            await fetch('/api/meta/ad-accounts'),
          ).catch(() => ({ adAccounts: [] })),
          json<{ pages: Array<{ id: string; name?: string }> }>(
            await fetch('/api/meta/pages'),
          ).catch(() => ({ pages: [] })),
        ]);
        setAdAccounts(aa.adAccounts ?? []);
        setPages(pp.pages ?? []);
      } else {
        setAdAccounts([]);
        setPages([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMeta = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await json<{ metaIntegration: MetaIntegration }>(
        await fetch('/api/meta/integration', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adAccountId, fbPageId }),
        }),
      );
      setMetaIntegration(res.metaIntegration);
      setSuccess('Saved Meta settings.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save Meta settings');
    } finally {
      setSaving(false);
    }
  }, [adAccountId, fbPageId]);

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
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meta setup, automation rules, and dashboard configuration.
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
      {success ? (
        <div className="glass-card border border-emerald-500/25 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Meta setup</h3>
            <p className="text-sm text-muted-foreground">
              Uses <code className="font-mono">META_SYSTEM_ACCESS_TOKEN</code> on the server.
            </p>
          </div>
          <span
            className={`glass-badge ${hasSystemToken ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}
          >
            {hasSystemToken ? 'System token: OK' : 'System token: missing'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Ad account id</div>
            {hasSystemToken && adAccounts.length ? (
              <select
                className="glass-input mt-1 w-full px-3 py-2 text-sm"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
              >
                <option value="">Select an ad account…</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ? `${a.name} (${a.id})` : a.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="glass-input mt-1 w-full px-3 py-2 text-sm"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="act_1234567890"
              />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Facebook page id</div>
            {hasSystemToken && pages.length ? (
              <select
                className="glass-input mt-1 w-full px-3 py-2 text-sm"
                value={fbPageId}
                onChange={(e) => setFbPageId(e.target.value)}
              >
                <option value="">Select a page…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ? `${p.name} (${p.id})` : p.id}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="glass-input mt-1 w-full px-3 py-2 text-sm"
                value={fbPageId}
                onChange={(e) => setFbPageId(e.target.value)}
                placeholder="1234567890"
              />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Last updated:{' '}
            <span className="font-data">
              {metaIntegration?.updatedAt ? new Date(metaIntegration.updatedAt).toLocaleString() : '—'}
            </span>
          </div>
          <button
            className="glass-button-primary px-4 py-2 text-sm"
            type="button"
            onClick={saveMeta}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

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

