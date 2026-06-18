'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

import type { AccessRequestRow } from '@/lib/superadmin/access-requests';
import type { StartupPlan } from '@/lib/onboarding/types';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function approachBadge(plan: unknown) {
  const p = plan as StartupPlan | null;
  if (!p?.recommendedApproach) return null;
  const labels = {
    aeo_first: 'AEO first',
    ads_first: 'Ads first',
    balanced: 'Balanced',
  };
  return labels[p.recommendedApproach];
}

function RequestCard({
  row,
  onApprove,
  onReject,
  busy,
}: {
  row: AccessRequestRow;
  onApprove: (id: string) => void;
  onReject: (id: string, note?: string) => void;
  busy: string | null;
}) {
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState('');
  const plan = row.onboardingPlan as StartupPlan | null;
  const isBusy = busy === row.id;

  return (
    <article className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
        {row.logoUrl ? (
          <Image src={row.logoUrl} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
            {row.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{row.name}</h3>
            <p className="text-sm text-muted-foreground">
              @{row.userName ?? '—'} · {row.email ?? '—'}
            </p>
            {row.domain ? (
              <p className="text-xs text-muted-foreground">{row.domain}</p>
            ) : null}
          </div>
          {row.accessRequestedAt ? (
            <time className="text-xs text-muted-foreground">
              {new Date(row.accessRequestedAt).toLocaleDateString()}
            </time>
          ) : null}
        </div>
        {(row.industry || row.oneLiner) && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {[row.industry, row.oneLiner].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.metaConnected && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
              Meta
            </span>
          )}
          {row.shopifyConnected && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
              Shopify
            </span>
          )}
          {approachBadge(row.onboardingPlan) && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {approachBadge(row.onboardingPlan)}
            </span>
          )}
        </div>
        {plan?.headline ? (
          <p className="mt-2 text-xs italic text-muted-foreground">&ldquo;{plan.headline}&rdquo;</p>
        ) : null}
        {showReject ? (
          <div className="mt-3 space-y-2">
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Optional note to applicant"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onReject(row.id, note)}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
              >
                <X className="h-3.5 w-3.5" /> Confirm decline
              </button>
              <button
                type="button"
                onClick={() => setShowReject(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onApprove(row.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Accept
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowReject(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Decline
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function AccessRequestsClient() {
  const [pending, setPending] = useState<AccessRequestRow[]>([]);
  const [reviewed, setReviewed] = useState<AccessRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<{ pending: AccessRequestRow[]; reviewed: AccessRequestRow[] }>(
        '/api/superadmin/access-requests',
      );
      setPending(data.pending);
      setReviewed(data.reviewed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (companyId: string) => {
    setBusy(companyId);
    try {
      await apiJson(`/api/superadmin/access-requests/${companyId}/approve`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (companyId: string, note?: string) => {
    setBusy(companyId);
    try {
      await apiJson(`/api/superadmin/access-requests/${companyId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Superadmin</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">Access requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review onboarding applications — accept to grant login access.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No pending requests
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((row) => (
            <RequestCard key={row.id} row={row} onApprove={approve} onReject={reject} busy={busy} />
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently reviewed
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {reviewed.map((r) => (
              <li key={r.id} className="flex justify-between rounded-lg border border-border px-3 py-2">
                <span>{r.name}</span>
                <span className={r.accessStatus === 'APPROVED' ? 'text-green-600' : 'text-destructive'}>
                  {r.accessStatus}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
