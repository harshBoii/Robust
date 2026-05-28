"use client";

import { useMemo, useState } from "react";
import {
  BountyHeader,
  BountyFilterTabs,
  BountyTable,
  type BountyFilterTab,
  type BountyNiche,
} from "@/app/components/geo/bounty";
import { RevenueChip } from "@/app/components/geo/revenue-chip";

type BountyMetricCard =
  | {
      label: string;
      kind: "count";
      value: string;
      note: string;
    }
  | {
      label: string;
      kind: "revenue";
      amount: number;
      note: string;
    };

type BountyViewProps = {
  initialNiches: BountyNiche[];
  summary: {
    total_niches: number;
    total_prompts: number;
    by_difficulty: { easy: number; medium: number; hard: number };
    prompts_cited?: number;
    prompts_uncited?: number;
    estimated_revenue_from_bounty: number;
    total_estimated_revenue_for_bounty_left: number;
  } | null;
};

type BountySortOption =
  | "name_asc"
  | "name_desc"
  | "revenue_desc"
  | "revenue_asc"
  | "date_desc"
  | "date_asc";

type TopicRevenueFilter = "all" | "with_revenue" | "no_revenue";

function compareTimestamps(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function BountyView({ initialNiches, summary }: BountyViewProps) {
  const [filter, setFilter] = useState<BountyFilterTab>("all");
  const [search, setSearch] = useState("");
  const [topicRevenueFilter, setTopicRevenueFilter] =
    useState<TopicRevenueFilter>("all");
  const [sort, setSort] = useState<BountySortOption>("date_desc");

  const counts = summary
    ? {
        all: summary.total_niches,
        easy: summary.by_difficulty.easy,
        medium: summary.by_difficulty.medium,
        hard: summary.by_difficulty.hard,
      }
    : {
        all: initialNiches.length,
        easy: initialNiches.filter((n) => n.difficulty.toLowerCase() === "easy").length,
        medium: initialNiches.filter((n) => n.difficulty.toLowerCase() === "medium").length,
        hard: initialNiches.filter((n) => n.difficulty.toLowerCase() === "hard").length,
      };

  const visibleNiches = useMemo(() => {
    let rows = initialNiches;

    if (filter !== "all") {
      rows = rows.filter((n) => n.difficulty.toLowerCase() === filter);
    }

    const needle = search.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (n) =>
          n.topic.toLowerCase().includes(needle) ||
          n.description.toLowerCase().includes(needle) ||
          n.prompts.some((p) => p.query.toLowerCase().includes(needle))
      );
    }

    if (topicRevenueFilter === "with_revenue") {
      rows = rows.filter((n) => n.topicEstimatedRevenue > 0);
    } else if (topicRevenueFilter === "no_revenue") {
      rows = rows.filter((n) => n.topicEstimatedRevenue <= 0);
    }

    const sorted = [...rows].sort((a, b) => {
      switch (sort) {
        case "name_asc":
          return a.topic.localeCompare(b.topic);
        case "name_desc":
          return b.topic.localeCompare(a.topic);
        case "revenue_desc":
          return b.topicEstimatedRevenue - a.topicEstimatedRevenue;
        case "revenue_asc":
          return a.topicEstimatedRevenue - b.topicEstimatedRevenue;
        case "date_desc":
          return compareTimestamps(b.createdAt, a.createdAt);
        case "date_asc":
          return compareTimestamps(a.createdAt, b.createdAt);
        default:
          return 0;
      }
    });

    return sorted;
  }, [initialNiches, filter, search, topicRevenueFilter, sort]);

  const bountyMetrics: BountyMetricCard[] = summary
    ? [
        {
          label: "prompts cited",
          kind: "count",
          value: Number(summary.prompts_cited ?? 0).toLocaleString(),
          note: "Active topic prompts with at least one LLM citation listing your company",
        },
        {
          label: "prompts uncited",
          kind: "count",
          value: Number(summary.prompts_uncited ?? 0).toLocaleString(),
          note: "Active topic prompts with no citation for your company yet",
        },
        {
          label: "estimated revenue from bounty",
          kind: "revenue",
          amount: Number(summary.estimated_revenue_from_bounty ?? 0),
          note: "Average estimated revenue per prompt (PromptRevenue)",
        },
        {
          label: "estimated revenue (uncited prompts)",
          kind: "revenue",
          amount: Number(summary.total_estimated_revenue_for_bounty_left ?? 0),
          note: "Sum of per-prompt estimates for active topic prompts with no company citation yet",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <BountyHeader />
      {bountyMetrics.length > 0 ? (
        <section className="glass-card card-anime-float rounded-xl p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {bountyMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg bg-[var(--glass)]/60 border border-[var(--glass-border)]/60 p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-2 min-h-[2rem] flex items-center">
                  {metric.kind === "count" ? (
                    <p className="text-2xl font-semibold tabular-nums text-foreground">
                      {metric.value}
                    </p>
                  ) : (
                    <RevenueChip
                      amount={metric.amount}
                      tooltipTitle={metric.label}
                      tooltipLines={[metric.note]}
                      size="md"
                    />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{metric.note}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <BountyFilterTabs
        activeTab={filter}
        onTabChange={setFilter}
        counts={counts}
      />
      <section className="glass-card rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search topic, description, prompts…"
          className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-2 text-sm outline-none focus:border-[var(--sibling-primary)]"
          aria-label="Search topics and prompts"
        />
        <select
          value={topicRevenueFilter}
          onChange={(e) =>
            setTopicRevenueFilter(e.target.value as TopicRevenueFilter)
          }
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-2 text-sm outline-none focus:border-[var(--sibling-primary)]"
          aria-label="Filter by topic revenue"
        >
          <option value="all">All topics (revenue)</option>
          <option value="with_revenue">Topic revenue greater than zero</option>
          <option value="no_revenue">No topic revenue</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as BountySortOption)}
          className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 px-3 py-2 text-sm outline-none focus:border-[var(--sibling-primary)]"
          aria-label="Sort topics"
        >
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="revenue_desc">Estimated revenue (high → low)</option>
          <option value="revenue_asc">Estimated revenue (low → high)</option>
          <option value="date_desc">Newest topic first</option>
          <option value="date_asc">Oldest topic first</option>
        </select>
      </section>
      <BountyTable
        niches={visibleNiches}
        hadTopicsBeforeFilter={initialNiches.length > 0}
      />
    </div>
  );
}
