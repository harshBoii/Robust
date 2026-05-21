/** Background Meta refresh when snapshot is older than this (ms). */
export const DASHBOARD_REFRESH_STALE_MS = 15 * 60 * 1000;

export function isDashboardSnapshotStale(lastRefreshedAt: string | null | undefined): boolean {
  if (!lastRefreshedAt) return true;
  const t = Date.parse(lastRefreshedAt);
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > DASHBOARD_REFRESH_STALE_MS;
}
