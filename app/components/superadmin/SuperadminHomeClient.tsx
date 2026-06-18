'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, Users } from 'lucide-react';

import type { CompanyOverviewRow, SuperadminOverview } from '@/lib/superadmin/overview-types';

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'var(--primary)',
  PENDING: '#f59e0b',
  REJECTED: '#ef4444',
};

type Tab = 'approved' | 'active';

async function apiJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

function CompanyTable({ rows }: { rows: CompanyOverviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No companies in this view
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Domain</th>
              <th className="px-4 py-3 font-semibold">Industry</th>
              <th className="px-4 py-3 font-semibold">Integrations</th>
              <th className="px-4 py-3 font-semibold">Sessions</th>
              <th className="px-4 py-3 font-semibold">Last seen</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {row.logoUrl ? (
                        <Image src={row.logoUrl} alt="" fill className="object-cover" unoptimized />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground">
                          {row.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-foreground">{row.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">@{row.userName ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.email ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.domain ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.industry ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {row.metaConnected ? (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                        Meta
                      </span>
                    ) : null}
                    {row.shopifyConnected ? (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                        Shopify
                      </span>
                    ) : null}
                    {!row.metaConnected && !row.shopifyConnected ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      row.activeSessionCount > 0
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground'
                    }
                  >
                    {row.activeSessionCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelative(row.lastSeenAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SuperadminHomeClient() {
  const [data, setData] = useState<SuperadminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('approved');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const overview = await apiJson<SuperadminOverview>('/api/superadmin/overview');
      setData(overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tableRows = useMemo(() => {
    if (!data) return [];
    if (tab === 'active') {
      return [...data.companies]
        .filter((c) => c.activeSessionCount > 0)
        .sort((a, b) => {
          const aTime = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bTime = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          return bTime - aTime;
        });
    }
    return data.companies;
  }, [data, tab]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Superadmin
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Home</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Platform overview — approved companies, live sessions, and onboarding funnel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="glass-button inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </header>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Approved" value={data.kpis.approvedCompanies} />
        <KpiCard label="Pending requests" value={data.kpis.pendingRequests} />
        <KpiCard label="Active sessions" value={data.kpis.activeSessionsNow} />
        <KpiCard
          label="Companies active"
          value={data.kpis.companiesActiveNow}
          hint="≥1 live session"
        />
        <KpiCard label="Meta adoption" value={`${data.kpis.metaAdoptionPct}%`} />
        <KpiCard label="Shopify adoption" value={`${data.kpis.shopifyAdoptionPct}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 lg:col-span-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Access status
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.accessStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {data.charts.accessStatus.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status] ?? 'var(--muted-foreground)'}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {data.charts.accessStatus.map((s) => (
              <li key={s.status} className="flex justify-between">
                <span>{s.status}</span>
                <span className="font-medium text-foreground">{s.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card/60 p-4 lg:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Signups (last 12 weeks)
          </p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.signupsByWeek} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Integration adoption
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.charts.integrationAdoption.map((item) => (
            <div key={item.name} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.connected}/{item.total} ({item.pct}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Companies</h2>
          </div>
          <div className="flex rounded-xl border border-border p-1">
            <button
              type="button"
              onClick={() => setTab('approved')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'approved'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All approved
            </button>
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active now
            </button>
          </div>
        </div>
        <CompanyTable rows={tableRows} />
      </section>
    </div>
  );
}
