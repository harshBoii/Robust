'use client';

import { useCallback, useEffect, useState } from 'react';

import SocialProviderConnectionPanel, {
  type ProviderStatus,
} from '@/app/components/profile/SocialProviderConnectionPanel';
import { socialProviderLabel } from '@/lib/auth/social-oauth-state';

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ providers: ProviderStatus[] }>(
        await fetch('/api/integrations/social', { credentials: 'include' }),
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10 pt-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-accent)]">
          Integrations
        </p>
        <h1 className="text-xl font-semibold text-foreground font-heading">Social Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link X, LinkedIn, and Reddit to publish bounty content after approval.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}

      <div className="space-y-6">
        {providers.map((p) => (
          <div key={p.provider}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {socialProviderLabel(p.provider)}
            </p>
            <SocialProviderConnectionPanel provider={p.provider} embedded />
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Social accounts are connected via Zernio. Manage connections under Profile → Integrations.
      </p>
    </div>
  );
}
