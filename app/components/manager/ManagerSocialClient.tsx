'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SocialProvider } from '@/app/generated/prisma/client';
import { socialProviderLabel } from '@/lib/auth/social-oauth-state';

type ProviderStatus = {
  provider: SocialProvider;
  connected: boolean;
  accountHandle: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
};

const START_PATHS: Record<SocialProvider, string> = {
  X: '/api/auth/x/start',
  LINKEDIN: '/api/auth/linkedin/start',
  REDDIT: '/api/auth/reddit/start',
};

const OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Account connected successfully.',
  config: 'OAuth is not configured for this provider.',
  token_exchange: 'Could not exchange authorization code.',
  missing_code: 'Authorization code missing.',
  missing_state: 'OAuth state missing.',
  invalid_state: 'Invalid OAuth state.',
  session: 'Sign in to connect social accounts.',
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function ManagerSocialClient() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ providers: ProviderStatus[] }>(
        await fetch('/api/integrations/social', { credentials: 'include' })
      );
      setProviders(data.providers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load social connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const provider = params.get('provider');
    const message = params.get('message');

    if (oauth === 'connected' && provider) {
      setSuccess(`${provider.toUpperCase()} connected successfully.`);
      void load();
    } else if (oauth === 'error') {
      setError(OAUTH_MESSAGES[message ?? ''] ?? 'Social connection failed.');
    }

    if (oauth) {
      params.delete('oauth');
      params.delete('provider');
      params.delete('message');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname);
    }
  }, [load]);

  const onDisconnect = async (provider: SocialProvider) => {
    setDisconnecting(provider);
    setError(null);
    setSuccess(null);
    try {
      await json(
        await fetch('/api/integrations/social', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        })
      );
      setSuccess(`${socialProviderLabel(provider)} disconnected.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10 pt-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-accent)]">
          Manager
        </p>
        <h1 className="text-xl font-semibold text-foreground font-heading">Social Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link X, LinkedIn, and Reddit to publish bounty content after approval.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}

      <div className="space-y-3">
        {providers.map((p) => (
          <div
            key={p.provider}
            className="glass-card rounded-xl border border-[var(--glass-border)] p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{socialProviderLabel(p.provider)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.connected
                  ? p.accountHandle
                    ? `Connected as @${p.accountHandle}`
                    : 'Connected'
                  : p.oauthConfigured
                    ? 'Not connected'
                    : 'OAuth not configured'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {p.connected ? (
                <button
                  type="button"
                  onClick={() => onDisconnect(p.provider)}
                  disabled={disconnecting === p.provider}
                  className="rounded-md border border-[var(--glass-border)] px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  {disconnecting === p.provider ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <a
                  href={p.oauthConfigured ? START_PATHS[p.provider] : undefined}
                  className={`glass-button-primary rounded-md px-3 py-1.5 text-xs font-semibold ${
                    !p.oauthConfigured ? 'pointer-events-none opacity-50' : ''
                  }`}
                  aria-disabled={!p.oauthConfigured}
                >
                  Connect
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Set OAuth redirect URI to <code className="font-mono">/api/auth/social/callback</code> for each
        provider. Required env vars: X_CLIENT_ID, X_CLIENT_SECRET, X_REDIRECT_URI, LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
        REDDIT_REDIRECT_URI.
      </p>
    </div>
  );
}
