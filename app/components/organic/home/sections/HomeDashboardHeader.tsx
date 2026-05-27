import RadarRefreshButton from '@/app/components/organic/home/RadarRefreshButton';

export function HomeDashboardHeader({ calculatedDate }: { calculatedDate: string | null }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
      <div>
        <h1 className="text-2xl font-semibold text-foreground font-heading tracking-tight md:text-3xl">
          GEO Authority Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          A curated analysis of search dominance, model sentiment, and actionable growth vectors
          for the current cycle.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {calculatedDate && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LAST {calculatedDate}
          </div>
        )}
        <RadarRefreshButton />
      </div>
    </div>
  );
}
