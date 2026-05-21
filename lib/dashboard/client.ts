'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import type { AutomationRule } from '@/app/components/dashboard/AutomationControls';
import type { Currency } from '@/lib/currency';
import { isDashboardSnapshotStale } from '@/lib/dashboard/constants';

export type DashboardMetric = {
  metaAdId: string;
  spend: number;
  ctr: number;
  statusSignal: string | null;
  datePreset: string;
  recordedAt: string;
};

type DashboardGetResponse = {
  rules: AutomationRule[];
  metrics?: DashboardMetric[];
  rows?: DashboardRow[];
  lastRefreshedAt?: string | null;
  snapshotStale?: boolean;
};

type RefreshResponse = { rows: DashboardRow[] };

export async function dashboardJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  if (!res.ok) {
    const err = data as unknown as { error?: string };
    throw new Error(err?.error ?? 'Request failed');
  }
  return data;
}

export function useDashboardData() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetric[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [busyAdIds, setBusyAdIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('INR');
  const backgroundRefreshStarted = useRef(false);

  const loadDashboard = useCallback(async () => {
    const data = await dashboardJson<DashboardGetResponse>(await fetch('/api/dashboard'));
    setRules(data.rules ?? []);
    setMetrics(data.metrics ?? []);
    setRows(data.rows ?? []);
    setLastRefreshedAt(data.lastRefreshedAt ?? null);
    return data;
  }, []);

  const refresh = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!opts?.background) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await dashboardJson<RefreshResponse>(
          await fetch('/api/dashboard/refresh', { method: 'POST' }),
        );
        setRows(data.rows ?? []);
        const cached = await loadDashboard();
        setLastRefreshedAt(cached.lastRefreshedAt ?? new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to refresh');
      } finally {
        setLoading(false);
      }
    },
    [loadDashboard],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setBootstrapping(true);
      setError(null);
      try {
        const data = await loadDashboard();
        if (cancelled) return;

        const stale =
          data.snapshotStale ?? isDashboardSnapshotStale(data.lastRefreshedAt);
        if (stale && !backgroundRefreshStarted.current) {
          backgroundRefreshStarted.current = true;
          void refresh({ background: true });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadDashboard, refresh]);

  const toggleStatus = useCallback(async (adId: string, nextStatus: 'ACTIVE' | 'PAUSED') => {
    setBusyAdIds((prev) => new Set(prev).add(adId));
    setError(null);
    try {
      await dashboardJson<{ ok: true }>(
        await fetch(`/api/meta/ads/${adId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }),
      );
      setRows((prev) => prev.map((r) => (r.adId === adId ? { ...r, status: nextStatus } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle ad');
    } finally {
      setBusyAdIds((prev) => {
        const next = new Set(prev);
        next.delete(adId);
        return next;
      });
    }
  }, []);

  const autoPause = useCallback(() => {
    const rule = rules.find((r) => r.ruleType === 'AUTO_PAUSE');
    if (!rule?.isEnabled || typeof rule.threshold !== 'number') return;
    const offenders = rows
      .filter((r) => (r.status ?? '').toUpperCase() === 'ACTIVE')
      .filter((r) => typeof r.cpi === 'number' && r.cpi > rule.threshold!);
    void (async () => {
      for (const r of offenders) await toggleStatus(r.adId, 'PAUSED');
    })();
  }, [rows, rules, toggleStatus]);

  return {
    rows,
    rules,
    metrics,
    lastRefreshedAt,
    busyAdIds,
    loading,
    bootstrapping,
    error,
    currency,
    setCurrency,
    refresh,
    toggleStatus,
    autoPause,
  };
}
