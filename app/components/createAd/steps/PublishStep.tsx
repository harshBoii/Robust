'use client';

import { useEffect, useMemo, useState } from 'react';

import { json } from '../shared';
import type { GroupModel } from '../types';

type JobRow = { id: string; status: string; lastError?: string | null };

const JOB_STATUS_STYLES: Record<string, string> = {
  QUEUED:      'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  PROCESSING:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  PUBLISHED:   'bg-clipfox-primary/10 text-clipfox-primary',
  FAILED:      'bg-destructive/10 text-destructive',
  CANCELLED:   'bg-muted text-muted-foreground',
};
function jobStatusStyle(s: string) {
  return JOB_STATUS_STYLES[s.toUpperCase()] ?? 'bg-muted text-muted-foreground';
}

export default function PublishStep({
  campaignId,
  groups,
  onPublished,
  onError,
}: {
  campaignId: string;
  groups: GroupModel[];
  onPublished: (jobIds: string[]) => void;
  onError: (message: string) => void;
}) {
  const includedGroups = useMemo(() => groups.filter((g) => g.included), [groups]);

  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [jobRows, setJobRows] = useState<JobRow[]>([]);

  const canPublish = useMemo(() => {
    if (!campaignId) return false;
    if (includedGroups.length === 0) return false;
    if (includedGroups.some((g) => !g.adSetId)) return false;
    if (includedGroups.some((g) => g.assetIds.length === 0)) return false;
    if (includedGroups.some((g) => !g.creative.headline.trim())) return false;
    if (includedGroups.some((g) => !g.creative.landingUrl.trim())) return false;
    return true;
  }, [campaignId, includedGroups]);

  async function publish() {
    setLoading(true);
    try {
      const resp = await json<{ jobIds: string[] }>(
        await fetch('/api/meta/publish/bulk', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId,
            scheduledAt: scheduledAt || undefined,
            groups: includedGroups.map((g) => ({
              bucketId: g.bucketId,
              assetIds: g.assetIds,
              adSetId: g.adSetId,
              headline: g.creative.headline,
              primaryText: g.creative.primaryText,
              description: g.creative.description || undefined,
              landingUrl: g.creative.landingUrl,
              ctaType: g.creative.ctaType,
              pixelId: g.creative.pixelId || undefined,
            })),
          }),
        }),
      );
      setJobIds(resp.jobIds ?? []);
      onPublished(resp.jobIds ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setLoading(false);
    }
  }

  // SSE job tracking (copied pattern from PostToMetaClient)
  useEffect(() => {
    if (!jobIds.length) return;
    let aborted = false;
    const ctrl = new AbortController();
    const qs = `ids=${encodeURIComponent(jobIds.join(','))}`;
    void (async () => {
      try {
        const res = await fetch(`/api/meta/publish/jobs?${qs}`, { method: 'POST', signal: ctrl.signal });
        if (!res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const p of parts) {
            const line = p.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6)) as { jobs?: JobRow[]; done?: boolean };
            if (payload.jobs) setJobRows(payload.jobs);
            if (payload.done) return;
          }
        }
      } catch {
        /* ignored */
      }
    })();
    return () => { aborted = true; ctrl.abort(); };
  }, [jobIds]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Campaign', value: campaignId || '—' },
          { label: 'Groups', value: `${includedGroups.length}` },
          { label: 'Assets', value: `${includedGroups.reduce((s, g) => s + g.assetIds.length, 0)}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border/40 bg-background/20 px-4 py-3">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scheduleAt" className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Schedule <span className="normal-case tracking-normal font-normal opacity-60">(optional)</span>
          </label>
          <input
            id="scheduleAt"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="glass-input px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={loading || !canPublish}
          className="glass-button-primary flex items-center gap-2 px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Publishing…' : scheduledAt ? 'Schedule ads' : 'Publish now'}
        </button>
      </div>

      {jobIds.length > 0 ? (
        <div className="animate-fade-up rounded-2xl border border-border/40 bg-background/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Job tracker
            </p>
            <span className="glass-badge">{jobIds.length} job{jobIds.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-border/30">
            {jobRows.length ? jobRows.map((j) => (
              <div key={j.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="font-data text-[11px] text-muted-foreground truncate">{j.id}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={[
                    'rounded-full px-2.5 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide',
                    jobStatusStyle(j.status),
                  ].join(' ')}>
                    {j.status}
                  </span>
                  {j.lastError ? (
                    <span className="text-[11px] text-destructive truncate max-w-[220px]" title={j.lastError ?? undefined}>
                      {j.lastError}
                    </span>
                  ) : null}
                </div>
              </div>
            )) : (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                Waiting for job updates…
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

