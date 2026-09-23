'use client';

import { useCallback, useEffect, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Check, Copy, KeyRound, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';

import { profileGhostButton, profileStatusBadge } from '@/app/components/profile/profile-utils';

type SiteInfo = {
  siteUrl: string;
  basePath: string;
  apiKeyPrefix: string;
  lastVerifiedAt: string | null;
  lastError: string | null;
};

type StatusResponse = {
  connected: boolean;
  site: SiteInfo | null;
  publishedCount: number;
  apiBaseUrl: string;
  defaultBlogDestination: string | null;
  prompt: string | null;
};

type ConnectResponse = {
  site: SiteInfo;
  credentials: { apiKey: string; revalidateSecret: string };
  prompt: string;
};

type TestResponse = { ok: boolean; problems: string[] };

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={
        primary
          ? 'inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90'
          : profileGhostButton
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function SecretRow({ label, envName, value }: { label: string; envName: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground">
          {label} <span className="font-data font-normal text-muted-foreground">{envName}</span>
        </span>
        <CopyButton text={value} label="Copy" />
      </div>
      <code className="block break-all font-data text-[11px] text-muted-foreground">{value}</code>
    </div>
  );
}

export default function NextjsConnectionPanel({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState('');
  const [basePath, setBasePath] = useState('/blog');
  const [busy, setBusy] = useState<'connect' | 'test' | 'save' | 'disconnect' | 'default' | null>(null);
  /** Only present right after connect/regenerate — the server never returns secrets again. */
  const [fresh, setFresh] = useState<ConnectResponse | null>(null);
  const [test, setTest] = useState<TestResponse | null>(null);

  // `loading` starts true and only gates the first render, so refreshes don't reset it.
  const load = useCallback(async () => {
    try {
      const data = await json<StatusResponse>(
        await fetch('/api/company/nextjs-site', { credentials: 'include' }),
      );
      setStatus(data);
      if (data.site) {
        setSiteUrl(data.site.siteUrl);
        setBasePath(data.site.basePath);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Next.js settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (isRegenerate: boolean) => {
    if (
      isRegenerate &&
      !window.confirm(
        'Generate new credentials? The current API key and revalidate secret stop working immediately, so the site will need the new values.',
      )
    ) {
      return;
    }
    setBusy('connect');
    setError(null);
    setTest(null);
    try {
      const data = await json<ConnectResponse>(
        await fetch('/api/company/nextjs-site', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, basePath }),
        }),
      );
      setFresh(data);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect');
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    setBusy('save');
    setError(null);
    try {
      await json(
        await fetch('/api/company/nextjs-site', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, basePath }),
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const toggleDefault = async (makeDefault: boolean) => {
    setBusy('default');
    setError(null);
    try {
      await json(
        await fetch('/api/company/nextjs-site', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ makeDefault }),
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update default');
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setError(null);
    try {
      const data = await json<TestResponse>(
        await fetch('/api/company/nextjs-site/test', { method: 'POST', credentials: 'include' }),
      );
      setTest(data);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect the Next.js site? Its API key stops working and the blog will stop updating.')) {
      return;
    }
    setBusy('disconnect');
    setError(null);
    try {
      await json(await fetch('/api/company/nextjs-site', { method: 'DELETE', credentials: 'include' }));
      setFresh(null);
      setTest(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <AiOutlineLoading className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const site = status?.site ?? null;
  const settingsDirty = Boolean(site) && (siteUrl.trim() !== site?.siteUrl || basePath.trim() !== site?.basePath);
  const isDefault = status?.defaultBlogDestination === 'nextjs';

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Publish bounty articles to your own Next.js site. Your site fetches published articles from Robust
        and renders them with metadata, an FAQ section and JSON-LD schema; Robust pings your site on every
        publish so new articles appear immediately.
      </p>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Site URL</span>
          <input
            className="glass-input mt-1 w-full px-3 py-2 text-sm"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://www.example.com"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Blog path</span>
          <input
            className="glass-input mt-1 w-full px-3 py-2 font-data text-sm"
            value={basePath}
            onChange={(e) => setBasePath(e.target.value)}
            placeholder="/blog"
          />
        </label>
      </div>

      {!site ? (
        <div>
          <button
            type="button"
            disabled={busy !== null || !siteUrl.trim()}
            onClick={() => void connect(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {busy === 'connect' ? <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Connect &amp; generate credentials
          </button>
        </div>
      ) : settingsDirty ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveSettings()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </button>
          {basePath.trim() !== site.basePath ? (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              Changing the blog path also requires updating <code className="font-data">BLOG_BASE_PATH</code> on your site.
            </span>
          ) : null}
        </div>
      ) : null}

      {fresh ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Install it with Claude Code</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Open Claude Code in your Next.js project and paste this prompt. It creates the blog pages,
                the revalidate endpoint and your <code className="font-data">.env.local</code>, then verifies the build.
              </p>
            </div>
          </div>
          <div>
            <CopyButton text={fresh.prompt} label="Copy Claude Code prompt" primary />
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            These credentials are shown only once and are included in the prompt. Also add them to your
            hosting provider&apos;s environment variables.
          </div>
          <SecretRow label="API key" envName="ROBUST_API_KEY" value={fresh.credentials.apiKey} />
          <SecretRow label="Revalidate secret" envName="ROBUST_REVALIDATE_SECRET" value={fresh.credentials.revalidateSecret} />
        </div>
      ) : null}

      {site ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {site.siteUrl}
                {site.basePath}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Key <span className="font-data">{site.apiKeyPrefix}…</span> · {status?.publishedCount ?? 0} published
                {site.lastVerifiedAt ? ` · verified ${new Date(site.lastVerifiedAt).toLocaleString()}` : ''}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                site.lastError ? profileStatusBadge.warning : site.lastVerifiedAt ? profileStatusBadge.success : profileStatusBadge.neutral
              }`}
            >
              {site.lastError ? 'Needs attention' : site.lastVerifiedAt ? 'Working' : 'Not verified yet'}
            </span>
          </div>

          {site.lastError ? (
            <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
              {site.lastError}
            </p>
          ) : null}
          {test?.ok ? (
            <p className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-700 dark:text-emerald-400">
              Connection works — your site accepted the revalidate ping and {site.basePath} loads.
            </p>
          ) : null}

          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--clipfox-primary)]"
              checked={isDefault}
              disabled={busy !== null}
              onChange={(e) => void toggleDefault(e.target.checked)}
            />
            Use as the default destination for website blogs
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy !== null} onClick={() => void runTest()} className={profileGhostButton}>
              {busy === 'test' ? <AiOutlineLoading className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Test connection
            </button>
            {!fresh && status?.prompt ? (
              <CopyButton text={status.prompt} label="Copy setup prompt (no secrets)" />
            ) : null}
            <button type="button" disabled={busy !== null} onClick={() => void connect(true)} className={profileGhostButton}>
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate credentials
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void disconnect()}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400"
            >
              {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
          {!fresh ? (
            <p className="text-[11px] text-muted-foreground">
              Secrets are only shown when generated. The setup prompt above has placeholders — regenerate
              credentials to get a ready-to-run prompt.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
