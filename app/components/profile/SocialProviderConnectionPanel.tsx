'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SocialProvider } from '@/app/generated/prisma/client';
import { socialProviderLabel } from '@/lib/auth/social-oauth-state';

export type ProviderStatus = {
  provider: SocialProvider;
  connected: boolean;
  accountHandle: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
};

const CONNECT_PATHS: Record<SocialProvider, string> = {
  X: '/api/integrations/zernio/connect?provider=X',
  LINKEDIN: '/api/integrations/zernio/connect?provider=LINKEDIN',
  REDDIT: '/api/integrations/zernio/connect?provider=REDDIT',
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

type SocialProviderConnectionPanelProps = {
  provider: SocialProvider;
  embedded?: boolean;
  onConnectClick?: () => void;
};

export default function SocialProviderConnectionPanel({
  provider,
  embedded = false,
  onConnectClick,
}: SocialProviderConnectionPanelProps) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ providers: ProviderStatus[] }>(
        await fetch('/api/integrations/social', { credentials: 'include' }),
      );
      const match = data.providers.find((p) => p.provider === provider) ?? null;
      setStatus(match);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connection');
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    setSuccess(null);
    try {
      await json(
        await fetch('/api/integrations/social', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        }),
      );
      setSuccess(`${socialProviderLabel(provider)} disconnected.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const label = socialProviderLabel(provider);

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-4'}>
      {!embedded ? (
        <p className="text-sm text-muted-foreground">
          Link {label} to publish bounty content after approval.
        </p>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      ) : null}

      {status ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {status.connected
                  ? status.accountHandle
                    ? `Connected as @${status.accountHandle}`
                    : 'Connected'
                  : status.oauthConfigured
                    ? 'Not connected'
                    : 'Zernio not configured'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {status.connected ? (
                <button
                  type="button"
                  onClick={() => void onDisconnect()}
                  disabled={disconnecting}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-60"
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : (
                <a
                  href={status.oauthConfigured ? CONNECT_PATHS[provider] : undefined}
                  className={`inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground ${
                    !status.oauthConfigured ? 'pointer-events-none opacity-50' : ''
                  }`}
                  aria-disabled={!status.oauthConfigured}
                  onClick={() => {
                    if (status.oauthConfigured) onConnectClick?.();
                  }}
                >
                  Connect
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {!loading && status && !status.oauthConfigured ? (
        <p className="text-xs text-muted-foreground">
          Zernio is not configured. Set ZERNIO_API_KEY on the server.
        </p>
      ) : null}
    </div>
  );
}
