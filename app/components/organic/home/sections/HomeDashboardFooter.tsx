import Link from 'next/link';

export function HomeDashboardFooter() {
  return (
    <section className="mt-10 rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[var(--glass)] to-[var(--glass)]/70 p-8 text-center print:mt-8">
      <h2 className="font-heading text-xl font-semibold text-foreground md:text-2xl">Ready to challenge a topic?</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Jump into GeoKnight for simulations, refresh Company Radar for the latest microservice run, or open Bounty to hunt high-impact queries.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row print:hidden">
        <Link href="/geo/geoknight" className="inline-flex min-w-[180px] justify-center rounded-lg bg-[var(--sibling-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--sibling-surface)] shadow-sm hover:opacity-95">
          Simulate topic duel
        </Link>
        <Link href="/geo/radar" className="inline-flex min-w-[180px] justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/90 px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-[var(--glass-hover)]">
          Company Radar
        </Link>
        <Link href="/geo/bounty" className="inline-flex min-w-[180px] justify-center rounded-lg bg-[var(--sibling-primary)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95">
          Open Bounty
        </Link>
      </div>
    </section>
  );
}

export function HomeDashboardLiveBar({
  activePromptCount,
  topicNodeCount,
  calculatedDate,
}: {
  activePromptCount: number;
  topicNodeCount: number;
  calculatedDate: string | null;
}) {
  return (
    <div className="mt-6 rounded-xl border border-[var(--glass-border)] bg-[var(--sibling-surface,hsl(224,24%,12%))] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-medium text-[var(--sibling-surface-fg,hsl(220,20%,88%))] opacity-80">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
        {activePromptCount > 0 && <span>{activePromptCount} ACTIVE PROMPTS SCANNING</span>}
        {topicNodeCount > 0 && <span>{topicNodeCount} TOPIC NODES</span>}
      </div>
      {calculatedDate && <span className="opacity-60">UPDATED {calculatedDate}</span>}
    </div>
  );
}
