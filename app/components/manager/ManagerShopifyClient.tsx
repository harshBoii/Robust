'use client';

import { useCallback, useEffect, useState } from 'react';
import { SiShopify } from 'react-icons/si';

const SHOPIFY_OAUTH_MESSAGES: Record<string, string> = {
  '1': 'Shopify connected successfully.',
  config: 'Shopify OAuth is not configured (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL or CMS credentials).',
  invalid_shop: 'Invalid store domain. Use your-store or your-store.myshopify.com.',
  invalid_state: 'Invalid OAuth state. Please try connecting again.',
  hmac: 'Shopify HMAC verification failed.',
  shop_taken: 'This store is already linked to another workspace.',
  token_exchange: 'Could not exchange the authorization code. Try again.',
  missing_params: 'Shopify did not return the required parameters.',
  no_install_url: 'No install URL configured. Set connectUrl in CMS or SHOPIFY_CONNECT_URL.',
  session: 'Sign in to connect Shopify.',
};

function shopifyOAuthMessage(code: string | null): string | null {
  if (!code) return null;
  return SHOPIFY_OAUTH_MESSAGES[code] ?? 'Shopify connection failed. Please try again.';
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

type ShopifyAppResponse = {
  cms: {
    expectedShopDomain: string | null;
    connectUrl: string | null;
  } | null;
  shop: {
    shopDomain: string;
    scopes: string | null;
    status: string;
  } | null;
  connected: boolean;
  envConfigured: boolean;
};

export default function ManagerShopifyClient({ embedded = false }: { embedded?: boolean }) {
  const [expectedShopDomain, setExpectedShopDomain] = useState('');
  const [connectUrl, setConnectUrl] = useState('');
  const [connected, setConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [scopes, setScopes] = useState<string | null>(null);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<ShopifyAppResponse>(
        await fetch('/api/company/shopify-app', { credentials: 'include' }),
      );
      setExpectedShopDomain(data.cms?.expectedShopDomain ?? data.shop?.shopDomain ?? '');
      setConnectUrl(data.cms?.connectUrl ?? '');
      setConnected(data.connected);
      setShopDomain(data.connected ? data.shop?.shopDomain ?? null : null);
      setScopes(data.shop?.scopes ?? null);
      setEnvConfigured(data.envConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Shopify settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get('shopify_connected');
    const errorParam = params.get('shopify_error');
    const message = shopifyOAuthMessage(connectedParam ?? errorParam);
    if (message) {
      if (connectedParam) {
        setSuccess(message);
        setError(null);
        void load();
      } else {
        setError(message);
        setSuccess(null);
      }
      params.delete('shopify_connected');
      params.delete('shopify_error');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [load]);

  const saveSettings = useCallback(async () => {
    const domain = expectedShopDomain.trim();
    const url = connectUrl.trim();
    if (!domain && !url) {
      setError('Enter a store domain and/or install URL to save.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: { expectedShopDomain?: string; connectUrl: string | null } = {
        connectUrl: url || null,
      };
      if (domain) body.expectedShopDomain = domain;

      await json(
        await fetch('/api/company/shopify-app', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }),
      );
      setSuccess('Shopify settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [expectedShopDomain, connectUrl]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await json(
        await fetch('/shopify/disconnect', {
          method: 'POST',
          credentials: 'include',
        }),
      );
      setConnected(false);
      setShopDomain(null);
      setSuccess('Shopify disconnected.');
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }, [load]);

  const shopForInstall = expectedShopDomain.trim();
  const installOAuthHref = shopForInstall
    ? `/shopify/install?shop=${encodeURIComponent(shopForInstall)}`
    : '#';

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">Shopify connection</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Install the app in your store, then complete OAuth to sync products.
            </p>
          </div>
          <button
            className="glass-button px-3 py-2 text-sm"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end">
          <button
            className="glass-button px-3 py-1.5 text-xs"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      )}

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
            <h3 className="text-lg font-semibold">Store &amp; credentials</h3>
            <p className="text-sm text-muted-foreground">
              Save your store domain and Partners install link before connecting.
            </p>
          </div>
          {connected ? (
            <span className="glass-badge text-emerald-600 dark:text-emerald-300">
              Connected · {shopDomain}
            </span>
          ) : (
            <span className="glass-badge text-muted-foreground">Not connected</span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="shop-domain">
              Store domain
            </label>
            <input
              id="shop-domain"
              className="glass-input mt-1 w-full px-3 py-2 text-sm"
              value={expectedShopDomain}
              onChange={(e) => setExpectedShopDomain(e.target.value)}
              placeholder="my-store.myshopify.com"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="connect-url">
              Install URL (connect URL)
            </label>
            <input
              id="connect-url"
              type="url"
              className="glass-input mt-1 w-full px-3 py-2 text-sm"
              value={connectUrl}
              onChange={(e) => setConnectUrl(e.target.value)}
              placeholder="https://admin.shopify.com/store/.../apps/your-app"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Shopify Partners or custom app install link used for step 1.
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            className="glass-button-primary px-4 py-2 text-sm"
            type="button"
            onClick={saveSettings}
            disabled={
              saving || (!expectedShopDomain.trim() && !connectUrl.trim())
            }
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <h3 className="text-lg font-semibold">Connect in two steps</h3>

        <div className="rounded-lg border border-black/[0.06] p-4">
          <p className="text-sm font-medium">Step 1 — Install app</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Opens your Shopify Partners install link in the merchant store. Save the install URL
            above first, or set SHOPIFY_CONNECT_URL on the server.
          </p>
          <a
            href="/shopify/install-app"
            className="glass-button mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            <SiShopify className="h-4 w-4" />
            Install app (step 1)
          </a>
        </div>

        <div className="rounded-lg border border-black/[0.06] p-4">
          <p className="text-sm font-medium">Step 2 — Connect (OAuth)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Authorize Robust to access your store Admin API.
          </p>
          {!envConfigured ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              OAuth is not configured. Set SHOPIFY_* env vars or CMS apiKey/apiSecret.
            </p>
          ) : null}
          <a
            href={installOAuthHref}
            className={`glass-button-primary mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${
              !shopForInstall || !envConfigured ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={!shopForInstall || !envConfigured}
          >
            <SiShopify className="h-4 w-4" />
            Connect (OAuth, step 2)
          </a>
        </div>

        {connected && scopes ? (
          <p className="text-xs text-muted-foreground">
            Scopes: <span className="font-data">{scopes}</span>
          </p>
        ) : null}

        {connected ? (
          <button
            type="button"
            className="glass-button px-4 py-2 text-sm text-red-700 dark:text-red-300"
            onClick={disconnect}
            disabled={disconnecting}
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect Shopify'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
