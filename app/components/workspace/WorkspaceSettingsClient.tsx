'use client';

import { useCallback, useEffect, useState } from 'react';

import AutomationControls, {
  type AutomationRule,
} from '@/app/components/dashboard/AutomationControls';

const META_OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Facebook connected. Your access token was updated.',
  needs_integration: 'Save your ad account and page first, then connect with Facebook.',
  session: 'Sign in to connect Facebook.',
  config: 'Meta OAuth is not configured on the server (META_APP_ID, META_APP_SECRET, META_REDIRECT_URI).',
  token_exchange: 'Could not exchange the Facebook authorization code. Try again.',
  error: 'Facebook authorization was denied or failed.',
  missing_code: 'Facebook did not return an authorization code.',
  invalid_state: 'Invalid OAuth state. Please try connecting again.',
};

function metaOAuthMessage(code: string | null): string | null {
  if (!code) return null;
  return META_OAUTH_MESSAGES[code] ?? 'Facebook connection failed. Please try again.';
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

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
  const [hasMetaOAuth, setHasMetaOAuth] = useState(false);
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
      const meta = await json<{
        metaIntegration: MetaIntegration | null;
        hasSystemToken: boolean;
        hasMetaOAuth: boolean;
      }>(await fetch('/api/meta/integration'));
      setMetaIntegration(meta.metaIntegration);
      setHasSystemToken(meta.hasSystemToken);
      setHasMetaOAuth(meta.hasMetaOAuth);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('meta_oauth');
    const message = metaOAuthMessage(oauth);
    if (message) {
      if (oauth === 'connected') {
        setSuccess(message);
        setError(null);
      } else {
        setError(message);
        setSuccess(null);
      }
      params.delete('meta_oauth');
      const qs = params.toString();
      const path = window.location.pathname + (qs ? `?${qs}` : '');
      window.history.replaceState({}, '', path);
      if (oauth === 'connected') {
        void load();
      }
    }
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
              Connect your Facebook account to store a long-lived user token, or use the system
              token for server-side API calls.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`glass-badge ${hasSystemToken ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}
            >
              {hasSystemToken ? 'System token: OK' : 'System token: missing'}
            </span>
            {metaIntegration ? (
              <span className="glass-badge text-emerald-600 dark:text-emerald-300">
                Integration saved
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {!hasMetaOAuth
              ? 'OAuth is not configured (META_APP_ID, META_APP_SECRET, META_REDIRECT_URI).'
              : !metaIntegration
                ? 'Save ad account and page below before connecting Facebook.'
                : 'Authorize Robust to update your workspace access token.'}
          </p>
          <a
            href="/api/auth/meta/start"
            className={`glass-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
              !hasMetaOAuth || !metaIntegration
                ? 'pointer-events-none opacity-50'
                : ''
            }`}
            aria-disabled={!hasMetaOAuth || !metaIntegration}
            tabIndex={!hasMetaOAuth || !metaIntegration ? -1 : 0}
            onClick={(e) => {
              if (!hasMetaOAuth || !metaIntegration) {
                e.preventDefault();
              }
            }}
          >
            <FacebookIcon className="h-4 w-4" />
            Connect with Facebook
          </a>
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

