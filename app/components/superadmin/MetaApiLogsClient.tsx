'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Search, XCircle } from 'lucide-react';

type CompanyOption = { id: string; name: string; slug: string };

type Stats = {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDurationMs: number | null;
  last24hCalls: number;
  byOperation: Array<{
    operation: string;
    total: number;
    successCount: number;
    successRate: number;
  }>;
};

type LogRow = {
  id: string;
  method: string;
  path: string;
  operation: string | null;
  requestUrl: string;
  requestPayload: unknown;
  responseStatus: number;
  responseBody: unknown;
  success: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Request failed');
  return data;
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'good' | 'bad' | 'neutral';
}) {
  const accentClass =
    accent === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'bad'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border/30 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground/90">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function LogEntry({ row }: { row: LogRow }) {
  const [open, setOpen] = useState(false);
  const when = new Date(row.createdAt).toLocaleString();

  return (
    <div className="rounded-xl border border-border/35 bg-background/80">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/30"
      >
        <div className="mt-0.5 shrink-0">
          {row.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">
              {row.method}
            </span>
            <span className="truncate text-[13px] font-medium text-foreground">
              {row.operation ?? row.path}
            </span>
            <span className="text-[11px] text-muted-foreground">HTTP {row.responseStatus}</span>
            {row.durationMs != null ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {row.durationMs}ms
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{row.path}</p>
          {!row.success && row.errorMessage ? (
            <p className="mt-1 text-[12px] text-destructive">{row.errorMessage}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-muted-foreground">{when}</p>
          <ChevronDown
            className={`ml-auto mt-1 h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border/25 px-4 py-3">
          <JsonBlock title="Request" value={row.requestPayload ?? { url: row.requestUrl }} />
          <JsonBlock title="Response" value={row.responseBody} />
        </div>
      ) : null}
    </div>
  );
}

export default function MetaApiLogsClient() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CompanyOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selected, setSelected] = useState<CompanyOption | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCompanies = useCallback(async (q: string) => {
    try {
      const data = await fetchJson<{ companies: CompanyOption[] }>(
        `/api/superadmin/meta-logs/companies?q=${encodeURIComponent(q)}`,
      );
      setSuggestions(data.companies ?? []);
      setMigrationRequired(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load companies';
      setError(msg);
      if (msg.includes('migration') || msg.includes('meta_api_logs')) {
        setMigrationRequired(true);
      }
    }
  }, []);

  const loadLogs = useCallback(async (companyId: string, cursor?: string | null) => {
    const isMore = Boolean(cursor);
    if (isMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ companyId, limit: '50' });
      if (cursor) params.set('cursor', cursor);
      const data = await fetchJson<{
        stats: Stats;
        logs: { rows: LogRow[]; nextCursor: string | null };
      }>(`/api/superadmin/meta-logs?${params.toString()}`);
      setStats(data.stats);
      setRows((prev) => (isMore ? [...prev, ...data.logs.rows] : data.logs.rows));
      setNextCursor(data.logs.nextCursor);
      setMigrationRequired(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load logs';
      setError(msg);
      if (msg.includes('migration') || msg.includes('meta_api_logs')) {
        setMigrationRequired(true);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies('');
  }, [loadCompanies]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCompanies(query);
    }, 200);
    return () => clearTimeout(t);
  }, [query, loadCompanies]);

  const pickCompany = (company: CompanyOption) => {
    setSelected(company);
    setQuery(company.name);
    setShowSuggestions(false);
    void loadLogs(company.id);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Superadmin</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Meta API logs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Full Meta Graph API request and response history per company. Access tokens are redacted in
          stored URLs.
        </p>
      </header>

        <div className="relative mb-8">
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSelected(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setShowSuggestions(false), 150);
              }}
              placeholder="Search company name, slug, or email…"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          {showSuggestions && suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border/40 bg-popover shadow-lg">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-muted/60"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickCompany(c)}
                  >
                    <span className="text-[13px] font-medium">{c.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{c.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {migrationRequired ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200">
            Run your Prisma migration for <code className="font-mono">meta_api_logs</code>, then{' '}
            <code className="font-mono">npx prisma generate</code>.
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        {selected && stats ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Success rate"
                value={`${stats.successRate}%`}
                hint={`${stats.successCount} ok · ${stats.failureCount} failed`}
                accent={stats.successRate >= 90 ? 'good' : stats.successRate < 70 ? 'bad' : 'neutral'}
              />
              <StatCard label="Total calls" value={String(stats.totalCalls)} hint="All time" />
              <StatCard label="Last 24h" value={String(stats.last24hCalls)} hint="Recent volume" />
              <StatCard
                label="Avg latency"
                value={stats.avgDurationMs != null ? `${Math.round(stats.avgDurationMs)}ms` : '—'}
                hint="Successful + failed"
              />
            </div>

            {stats.byOperation.length > 0 ? (
              <div className="mb-8 overflow-hidden rounded-xl border border-border/40">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Operation</th>
                      <th className="px-4 py-2.5 font-medium">Calls</th>
                      <th className="px-4 py-2.5 font-medium">Success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byOperation.map((op) => (
                      <tr key={op.operation} className="border-t border-border/25">
                        <td className="px-4 py-2.5 font-mono">{op.operation}</td>
                        <td className="px-4 py-2.5">{op.total}</td>
                        <td className="px-4 py-2.5">{op.successRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}

        {!selected ? (
          <p className="text-[14px] text-muted-foreground">Select a company to view Meta API history.</p>
        ) : loading ? (
          <p className="text-[14px] text-muted-foreground">Loading logs…</p>
        ) : (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">No Meta API calls logged for this company yet.</p>
            ) : (
              rows.map((row) => <LogEntry key={row.id} row={row} />)
            )}
            {nextCursor ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadLogs(selected.id, nextCursor)}
                className="w-full rounded-xl border border-border/40 py-2.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted/40 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </div>
        )}
    </div>
  );
}
