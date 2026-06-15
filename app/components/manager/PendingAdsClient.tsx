'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Loader2, Send } from 'lucide-react';

import { MetaAdPreviewSingle } from '@/app/components/createAd/MetaAdPreviewGallery';
import type { Asset, CreativeFields } from '@/app/components/createAd/types';
import { useToast } from '@/app/components/UI/ToastProvider';

type PendingRow = {
  id: string;
  status: string;
  createdAt: string;
  headline: string | null;
  campaignName: string | null;
  adSetName: string | null;
  assetId: string;
  creative: CreativeFields;
  asset: Asset;
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export default function PendingAdsClient() {
  const toast = useToast();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await json<{ rows: PendingRow[] }>(
        await fetch('/api/manager/pending', { credentials: 'include' }),
      );
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (jobId: string, action: 'publish' | 'schedule', scheduledAt?: string) => {
    setBusyId(jobId);
    try {
      await json(
        await fetch('/api/manager/pending', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, action, scheduledAt }),
        }),
      );
      toast.push({ title: action === 'publish' ? 'Ad queued for publish' : 'Ad scheduled', kind: 'success' });
      setScheduleFor(null);
      await load();
    } catch (e) {
      toast.push({
        title: e instanceof Error ? e.message : 'Action failed',
        kind: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col px-4 py-8">
      <div className="mb-6 shrink-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">Pending Ads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafted ads from auto mode — review the preview, then publish or schedule.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-12 text-center text-sm text-muted-foreground">
          No drafted ads. Turn on auto mode in chat with auto-post off to draft ads here.
        </p>
      ) : (
        <div className="grid gap-6 pb-4 lg:grid-cols-2">
          {rows.map((row) => (
            <article
              key={row.id}
              className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card/40 p-4"
            >
              <MetaAdPreviewSingle
                creative={row.creative}
                asset={row.asset}
                label={row.headline || row.creative.headline || 'Untitled ad'}
              />

              <div className="space-y-1 border-t border-border/40 pt-3">
                <p className="text-xs text-muted-foreground">
                  {[row.campaignName, row.adSetName].filter(Boolean).join(' · ') || 'Meta campaign'}
                </p>
                <p className="text-[11px] text-muted-foreground/80">
                  Drafted {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>

              {scheduleFor === row.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!scheduleAt || busyId === row.id}
                    onClick={() => void act(row.id, 'schedule', new Date(scheduleAt).toISOString())}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleFor(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, 'publish')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs font-medium hover:border-primary/40"
                  >
                    {busyId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Publish
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => {
                      setScheduleFor(row.id);
                      setScheduleAt('');
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs font-medium hover:border-primary/40"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Schedule
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
