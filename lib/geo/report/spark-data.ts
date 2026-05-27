type RadarPayload = Awaited<
  ReturnType<typeof import('@/lib/geo/radar/buildRadarGetPayload').buildRadarGetPayload>
>;

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Daily averages from radar metric rows for mini trend strips (last `take` UTC days). */
export function buildDailySparkSeries(
  sovSeries: RadarPayload['sovSeries'],
  take = 14,
): { sov: number[]; top3: number[]; coverage: number[]; rank: number[] } {
  type DayBucket = { sov: number[]; top3: number[]; cov: number[]; rank: number[] };
  const byDay = new Map<number, DayBucket>();
  for (const row of sovSeries) {
    const ts = new Date(row.calculatedAt);
    if (!Number.isFinite(ts.getTime())) continue;
    const dayKey = Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate());
    const cur = byDay.get(dayKey) ?? { sov: [], top3: [], cov: [], rank: [] };
    if (row.shareOfVoice != null && !Number.isNaN(row.shareOfVoice)) cur.sov.push(row.shareOfVoice);
    if (row.top3Rate != null && !Number.isNaN(row.top3Rate)) cur.top3.push(row.top3Rate);
    if (row.queryCoverage != null && !Number.isNaN(row.queryCoverage)) cur.cov.push(row.queryCoverage);
    if (row.avgRank != null && !Number.isNaN(Number(row.avgRank))) cur.rank.push(Number(row.avgRank));
    byDay.set(dayKey, cur);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b).slice(-take);
  return {
    sov: days.map((d) => avg(byDay.get(d)!.sov)),
    top3: days.map((d) => avg(byDay.get(d)!.top3)),
    coverage: days.map((d) => avg(byDay.get(d)!.cov)),
    rank: days.map((d) => avg(byDay.get(d)!.rank)),
  };
}
