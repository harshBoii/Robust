'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Copy, RefreshCw } from 'lucide-react';
import { useToast } from '@/app/components/UI/ToastProvider';

type HistoryRow = {
  kind: 'ad' | 'job';
  id: string;
  status: string;
  createdAt: string;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  name: string;
  campaignName: string | null;
  adSetName: string | null;
  presetName: string | null;
  lastError: string | null;
  metaAdId: string | null;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function HistoryClient() {
  const toast = useToast();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'PROCESSING' | 'FAILED'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (status !== 'ALL') qs.set('status', status);
      const data = await json<{ rows: HistoryRow[] }>(await fetch(`/api/manager/history?${qs.toString()}`, { credentials: 'include' }));
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => rows, [rows]);

  const duplicate = useCallback(async (metaAdId: string) => {
    const assetId = window.prompt('Paste replacement creative Asset ID');
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      await json<{ jobId: string }>(
        await fetch(`/api/meta/ads/${encodeURIComponent(metaAdId)}/duplicate`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId }),
        }),
      );
      toast.push({ kind: 'success', title: 'Duplicate queued', message: 'New publish job created.' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed');
      toast.push({ kind: 'error', title: 'Duplicate failed', message: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [load, toast]);

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Ad History</h1>
          <p className="mt-2 text-muted-foreground">Active, processing, and historical ads (jobs + published ads).</p>
        </div>
        <button type="button" className="glass-button px-3 py-2 text-sm flex items-center gap-2" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="glass-input px-3 py-2 text-sm w-72"
          placeholder="Search by name / id / campaign…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="glass-input px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="ARCHIVED">Archived</option>
          <option value="PROCESSING">Processing</option>
          <option value="FAILED">Failed</option>
        </select>

        {loading && (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="max-h-[650px] overflow-auto rounded-2xl border border-border/50">
        <table className="w-full min-w-[1100px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-10">
            <tr className="bg-background/60 backdrop-blur-sm border-b border-border/40">
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Creative</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Name</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Campaign</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Adset</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Preset</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-3 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Created</th>
              <th className="px-3 py-3 text-right font-ui text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.kind}:${r.id}`}
                className={[
                  'border-b border-border/30 transition-colors duration-150 hover:bg-[var(--glass-hover)]',
                  i % 2 === 0 ? '' : 'bg-background/10',
                ].join(' ')}
              >
                <td className="px-3 py-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-border/50 bg-muted shadow-sm">
                    {r.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground/40">—</div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="max-w-[360px] truncate text-sm font-medium text-foreground">{r.name}</div>
                  <div className="font-data mt-0.5 truncate text-[11px] text-muted-foreground/70">{r.id}</div>
                  {r.lastError ? (
                    <div className="mt-1 text-[11px] text-red-600/80 truncate max-w-[360px]">{r.lastError}</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">{r.campaignName ?? '—'}</td>
                <td className="px-3 py-3 text-sm text-muted-foreground">{r.adSetName ?? '—'}</td>
                <td className="px-3 py-3 text-sm text-muted-foreground">{r.presetName ?? '—'}</td>
                <td className="px-3 py-3">
                  <span className="glass-badge text-[10px] px-2 py-0.5">{r.status}</span>
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                  {r.scheduledAt ? (
                    <div className="text-[11px] text-muted-foreground/60">
                      Scheduled: {new Date(r.scheduledAt).toLocaleString()}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.kind === 'ad' ? (
                    <button
                      type="button"
                      className="glass-button px-3 py-2 text-xs inline-flex items-center gap-2"
                      onClick={() => duplicate(r.id)}
                      disabled={loading}
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}

            {!filtered.length && !loading && (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                  No rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

