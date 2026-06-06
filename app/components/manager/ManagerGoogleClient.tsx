'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SiGoogle } from 'react-icons/si';
import { ExternalLink, BarChart2, Loader2, Check } from 'lucide-react';

export default function ManagerGoogleClient() {
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncMetrics = async () => {
    setSyncing(true);
    setSyncDone(false);
    setSyncError(null);
    try {
      const res = await fetch('/api/google-ads/metrics/sync', { method: 'POST', credentials: 'include' });
      const data = (await res.json()) as { ok?: boolean; synced?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sync failed');
      setSyncDone(true);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4285F4]/10">
        <SiGoogle className="h-7 w-7 text-[#4285F4]" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">Google Ads</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          Create Search, Display, and Performance Max campaigns on Google.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Link
          href="/manager/post-google"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Post to Google
        </Link>
        <Link
          href="/manager/history?platform=GOOGLE"
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          Ad History (Google)
        </Link>
        <button
          type="button"
          onClick={syncMetrics}
          disabled={syncing}
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : syncDone ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <BarChart2 className="h-4 w-4" />
          )}
          {syncing ? 'Syncing…' : syncDone ? 'Metrics synced' : 'Sync Metrics'}
        </button>
        {syncError && (
          <p className="text-xs text-red-500">{syncError}</p>
        )}
        <Link
          href="/profile/integration?modal=google-ads"
          className="flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          Manage Connection
        </Link>
      </div>
    </div>
  );
}
