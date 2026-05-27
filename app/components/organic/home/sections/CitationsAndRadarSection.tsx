import { CitationsTable, type CitationRow } from '@/app/components/organic/home/CitationsTable';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

type RadarMetricRow = {
  id: string;
  model: string;
  shareOfVoice: number | null;
  top3Rate: number | null;
  queryCoverage: number | null;
};

type RadarChartPoint = { subject: string; value: number; fullMark: number };

export function CitationsAndRadarSection({
  recentCitations,
  ourName,
  radarChartData,
  metrics,
}: {
  recentCitations: CitationRow[];
  ourName: string;
  radarChartData: RadarChartPoint[];
  metrics: RadarMetricRow[];
}) {
  if (recentCitations.length === 0 && radarChartData.length === 0) return null;

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {recentCitations.length > 0 && (
        <div className="glass-card card-anime-float rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground font-heading">Recent Model Citations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Latest citation events from tracked prompts</p>
          <CitationsTable citations={recentCitations} ourCompanyName={ourName} />
        </div>
      )}

      {radarChartData.length > 0 && (
        <div className="glass-card card-anime-float min-w-0 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground font-heading">Historical Radar Metrics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Latest radar run snapshot</p>
          <div className="mt-4 h-52 w-full min-w-0">
            <ResponsiveContainer width="100%" height={208} minWidth={0}>
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="var(--glass-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <Radar dataKey="value" stroke="var(--sibling-accent)" fill="var(--sibling-accent)" fillOpacity={0.18} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left py-1.5 font-medium text-muted-foreground">Model</th>
                  <th className="text-right py-1.5 font-medium text-muted-foreground">SoV</th>
                  <th className="text-right py-1.5 font-medium text-muted-foreground">Top-3</th>
                  <th className="text-right py-1.5 font-medium text-muted-foreground">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 6).map((m) => (
                  <tr key={m.id} className="border-b border-[var(--glass-border)]/50">
                    <td className="py-1.5 font-medium text-foreground">{m.model}</td>
                    <td className="text-right py-1.5 tabular-nums">{m.shareOfVoice != null ? `${m.shareOfVoice.toFixed(1)}%` : '—'}</td>
                    <td className="text-right py-1.5 tabular-nums">{m.top3Rate != null ? `${m.top3Rate.toFixed(1)}%` : '—'}</td>
                    <td className="text-right py-1.5 tabular-nums">{m.queryCoverage != null ? `${m.queryCoverage.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
