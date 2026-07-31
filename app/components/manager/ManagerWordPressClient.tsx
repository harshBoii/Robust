'use client';

import { useCallback, useEffect, useState } from 'react';
import { SiWordpress } from 'react-icons/si';

const WORDPRESS_MESSAGES: Record<string, string> = {
  '1': 'WordPress connected successfully.',
  server_not_configured:
    'WordPress publishing is not configured on the server (WORDPRESS_CREDENTIALS_SECRET).',
  callback_origin_missing: 'WORDPRESS_CALLBACK_ORIGIN is not set on the server.',
  invalid_site_url: 'That does not look like a valid site URL. Use https://example.com.',
  rest_unreachable:
    'Could not reach the WordPress REST API at that address. Check the URL, and that a security plugin is not blocking /wp-json.',
  state_mismatch: 'The connection link expired. Please try connecting again.',
  declined: 'Authorization was declined in WordPress.',
  missing_credentials: 'WordPress did not return an application password.',
  site_mismatch: 'WordPress returned a different site than the one you entered.',
  persist_failed: 'Could not save the WordPress connection. Please try again.',
};

const WARNING_MESSAGES: Record<string, string> = {
  cannot_publish:
    'Connected, but this WordPress user cannot publish posts. Reconnect as an Editor or Administrator.',
  probe_failed:
    'Connected, but we could not detect this site’s capabilities. Use “Verify site” to retry.',
};

/** How JSON-LD will reach the rendered page, and what the user should do about it. */
const SCHEMA_STATUS: Record<
  string,
  { label: string; tone: 'good' | 'warn' | 'bad'; detail: string }
> = {
  PLUGIN: {
    label: 'Full schema',
    tone: 'good',
    detail:
      'The Immortel Schema Bridge plugin is installed. JSON-LD is written to the page head, exactly like Shopify metafields.',
  },
  INLINE: {
    label: 'Inline schema',
    tone: 'warn',
    detail:
      'JSON-LD will be embedded in the post body. Search engines read it, but install the Schema Bridge plugin for head-level output and SEO-plugin merging.',
  },
  SEO_PLUGIN: {
    label: 'SEO plugin only',
    tone: 'warn',
    detail:
      'Your SEO plugin controls structured data, so only the SEO title and description are set. Install the Schema Bridge plugin to publish the full graph.',
  },
  UNAVAILABLE: {
    label: 'No schema',
    tone: 'bad',
    detail:
      'This site has no way to render JSON-LD, so posts will publish without structured data. Install the Schema Bridge plugin, or connect as a user with the unfiltered_html capability.',
  },
};

function connectMessage(code: string | null): string | null {
  if (!code) return null;
  return WORDPRESS_MESSAGES[code] ?? 'WordPress connection failed. Please try again.';
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

type WordPressSiteView = {
  id: string;
  siteUrl: string;
  username: string;
  hasAppPassword: boolean;
  authType: string;
  status: string;
  wpVersion: string | null;
  jsonLdMode: keyof typeof SCHEMA_STATUS | string;
  pluginVersion: string | null;
  seoPlugin: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
};

type WordPressAppResponse = {
  site: WordPressSiteView | null;
  connected: boolean;
  envConfigured: boolean;
  pluginDownloadUrl: string;
  defaultBlogDestination: 'shopify' | 'wordpress' | null;
};

export default function ManagerWordPressClient({
  embedded = false,
  onConnectClick,
}: {
  embedded?: boolean;
  onConnectClick?: () => void;
}) {
  const [siteUrlInput, setSiteUrlInput] = useState('');
  const [site, setSite] = useState<WordPressSiteView | null>(null);
  const [connected, setConnected] = useState(false);
  const [envConfigured, setEnvConfigured] = useState(false);
  const [pluginDownloadUrl, setPluginDownloadUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual fallback for sites that block authorize-application.php.
  const [showManual, setShowManual] = useState(false);
  const [manualUser, setManualUser] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<WordPressAppResponse>(
        await fetch('/api/company/wordpress-app', { credentials: 'include' }),
      );
      setSite(data.site);
      setConnected(data.connected);
      setEnvConfigured(data.envConfigured);
      setPluginDownloadUrl(data.pluginDownloadUrl);
      if (data.site?.siteUrl) setSiteUrlInput(data.site.siteUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load WordPress settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Surface the outcome of a redirect back from wp-admin, then scrub the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get('wordpress_connected');
    const errorParam = params.get('wordpress_error');
    const warningParam = params.get('wordpress_warning');

    if (connectedParam) setSuccess(connectMessage(connectedParam));
    if (errorParam) setError(connectMessage(errorParam));
    if (warningParam) setError(WARNING_MESSAGES[warningParam] ?? null);

    if (connectedParam || errorParam || warningParam) {
      params.delete('wordpress_connected');
      params.delete('wordpress_error');
      params.delete('wordpress_warning');
      params.delete('wordpress_schema');
      const qs = params.toString();
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}`,
      );
    }
  }, []);

  const verify = useCallback(async () => {
    setVerifying(true);
    setError(null);
    setSuccess(null);
    try {
      await json(
        await fetch('/api/company/wordpress-app', {
          method: 'POST',
          credentials: 'include',
        }),
      );
      setSuccess('Site verified.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [load]);

  const saveManual = useCallback(async () => {
    setSavingManual(true);
    setError(null);
    setSuccess(null);
    try {
      await json(
        await fetch('/api/company/wordpress-app', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: siteUrlInput.trim(),
            username: manualUser.trim(),
            appPassword: manualPassword,
          }),
        }),
      );
      setSuccess('WordPress connected successfully.');
      setManualPassword('');
      setShowManual(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
    } finally {
      setSavingManual(false);
    }
  }, [siteUrlInput, manualUser, manualPassword, load]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);
    setSuccess(null);
    try {
      await json(
        await fetch('/wordpress/disconnect', { method: 'POST', credentials: 'include' }),
      );
      setSuccess('WordPress disconnected.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect');
    } finally {
      setDisconnecting(false);
    }
  }, [load]);

  const trimmedSite = siteUrlInput.trim();
  const connectHref = trimmedSite
    ? `/wordpress/authorize?site=${encodeURIComponent(trimmedSite)}`
    : '#';
  const canConnect = Boolean(trimmedSite) && envConfigured;

  const schema = site ? SCHEMA_STATUS[site.jsonLdMode] : undefined;
  const schemaToneClass =
    schema?.tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-300'
      : schema?.tone === 'warn'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-red-700 dark:text-red-300';

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              WordPress connection
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Authorize an application password so we can publish blog posts to your site.
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
            <h3 className="text-lg font-semibold">Site</h3>
            <p className="text-sm text-muted-foreground">
              Your WordPress address. Self-hosted sites over HTTPS.
            </p>
          </div>
          {connected && site ? (
            <span className="glass-badge text-emerald-600 dark:text-emerald-300">
              Connected · {site.username}
            </span>
          ) : (
            <span className="glass-badge text-muted-foreground">Not connected</span>
          )}
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="wp-site-url">
            Site URL
          </label>
          <input
            id="wp-site-url"
            type="url"
            className="glass-input mt-1 w-full px-3 py-2 text-sm"
            value={siteUrlInput}
            onChange={(e) => setSiteUrlInput(e.target.value)}
            placeholder="https://example.com"
          />
        </div>

        {!envConfigured ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            WordPress publishing is not configured on the server. Set
            WORDPRESS_CREDENTIALS_SECRET and WORDPRESS_CALLBACK_ORIGIN.
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={connectHref}
            className={`glass-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${
              canConnect ? '' : 'pointer-events-none opacity-50'
            }`}
            aria-disabled={!canConnect}
            onClick={() => {
              if (canConnect) onConnectClick?.();
            }}
          >
            <SiWordpress className="h-4 w-4" />
            {connected ? 'Reconnect' : 'Connect WordPress'}
          </a>
          <button
            type="button"
            className="glass-button px-3 py-2 text-xs"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? 'Hide manual setup' : 'Enter credentials manually'}
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          You will be sent to your own WordPress admin to approve an application password. We
          never see your account password.
        </p>

        {showManual ? (
          <div className="mt-4 space-y-3 rounded-lg border border-black/[0.06] p-4">
            <p className="text-sm font-medium">Manual application password</p>
            <p className="text-xs text-muted-foreground">
              Use this if your host blocks the one-click flow. In WordPress go to Users → Profile
              → Application Passwords, create one, and paste it here.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="wp-user">
                WordPress username
              </label>
              <input
                id="wp-user"
                className="glass-input mt-1 w-full px-3 py-2 text-sm"
                value={manualUser}
                onChange={(e) => setManualUser(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="wp-pass">
                Application password
              </label>
              <input
                id="wp-pass"
                type="password"
                className="glass-input mt-1 w-full px-3 py-2 text-sm font-data"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="glass-button-primary px-4 py-2 text-sm"
                onClick={saveManual}
                disabled={
                  savingManual ||
                  !trimmedSite ||
                  !manualUser.trim() ||
                  !manualPassword.trim()
                }
              >
                {savingManual ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {connected && site ? (
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Structured data</h3>
              <p className="text-sm text-muted-foreground">
                How JSON-LD reaches your published posts.
              </p>
            </div>
            {schema ? (
              <span className={`glass-badge ${schemaToneClass}`}>{schema.label}</span>
            ) : null}
          </div>

          {schema ? <p className="text-xs text-muted-foreground">{schema.detail}</p> : null}

          {site.seoPlugin ? (
            <p className="text-xs text-muted-foreground">
              Detected SEO plugin:{' '}
              <span className="font-data">
                {site.seoPlugin === 'yoast' ? 'Yoast SEO' : 'Rank Math'}
              </span>
            </p>
          ) : null}

          {site.jsonLdMode !== 'PLUGIN' && pluginDownloadUrl ? (
            <a
              href={pluginDownloadUrl}
              className="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              Download Schema Bridge plugin
            </a>
          ) : site.pluginVersion ? (
            <p className="text-xs text-muted-foreground">
              Schema Bridge plugin <span className="font-data">v{site.pluginVersion}</span>
            </p>
          ) : null}

          {site.lastError ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">{site.lastError}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="glass-button px-4 py-2 text-sm"
              onClick={verify}
              disabled={verifying}
            >
              {verifying ? 'Verifying…' : 'Verify site'}
            </button>
            <button
              type="button"
              className="glass-button px-4 py-2 text-sm text-red-700 dark:text-red-300"
              onClick={disconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect WordPress'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
