'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DashboardRow } from '@/app/components/dashboard/AdPerformanceTable';
import type { AutomationRule } from '@/app/components/dashboard/AutomationControls';
import type { Currency } from '@/lib/currency';

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
  const [busyAdIds, setBusyAdIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>('INR');

  const loadDashboardCache = useCallback(async () => {
    const data = await dashboardJson<DashboardGetResponse>(await fetch('/api/dashboard'));
    setRules(data.rules ?? []);
    setMetrics(data.metrics ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const seeded = await dashboardJson<{ rules: AutomationRule[] }>(
        await fetch('/api/dashboard/automation', { method: 'POST' }),
      );
      setRules(seeded.rules);
      const data = await dashboardJson<RefreshResponse>(
        await fetch('/api/dashboard/refresh', { method: 'POST' }),
      );
      setRows(data.rows ?? []);
      await loadDashboardCache();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [loadDashboardCache]);

  useEffect(() => {
    void (async () => {
      try {
        await loadDashboardCache();
      } catch {
        /* ignored */
      }
      await refresh();
    })();
  }, [loadDashboardCache, refresh]);

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
    busyAdIds,
    loading,
    error,
    currency,
    setCurrency,
    refresh,
    toggleStatus,
    autoPause,
  };
}
