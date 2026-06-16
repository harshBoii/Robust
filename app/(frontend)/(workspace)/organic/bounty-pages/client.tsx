"use client";

// import LoadingAnimation from "@/app/components/animations/loading";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platformLabel, SPREAD_PLATFORM_OPTIONS } from "@/lib/geo/bounty/spread-platforms";
import { extractPostText } from "@/app/components/geo/bounty/content-metadata";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";


type AeoPageSummary = {
  id: string;
  slug: string;
  locale: string;
  title: string | null;
  description: string | null;
  status: string;
  pageType: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
};

type BountyContentSummary = {
  id: string;
  platform: string;
  status: string;
  title: string | null;
  body?: string | null;
  metadata?: unknown;
  publishedUrl: string | null;
  publishedAt: string | null;
};

type BountyRow = {
  id: string;
  query: string;
  status: string;
  confidence: number;
  difficulty: string;
  spreadPlatforms?: unknown;
  aeoPage: AeoPageSummary | null;
  contents?: BountyContentSummary[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const slice = words.slice(0, count).join(" ");
  return words.length > count ? `${slice}…` : slice;
}

function getContentExcerpt(content: BountyContentSummary): string {
  const fromBody = extractPostText(content.body ?? "", content.metadata);
  if (fromBody) return firstWords(fromBody, 20);
  if (content.title?.trim()) return firstWords(content.title, 20);
  return "";
}

function getBountyDisplayTitle(b: BountyRow): string {
  const page = b.aeoPage;
  if (page?.title?.trim()) return page.title.trim();

  const contents = b.contents ?? [];

  if (page) {
    const blogExcerpt = page.description?.trim() ? firstWords(page.description, 20) : "";
    if (blogExcerpt) return `${platformLabel("WEBSITE_BLOG")} · ${blogExcerpt}`;
  }

  for (const content of contents) {
    const excerpt = getContentExcerpt(content);
    if (excerpt) {
      return `${platformLabel(content.platform as BountySpreadPlatform)} · ${excerpt}`;
    }
  }

  for (const content of contents) {
    if (content.title?.trim()) {
      return `${platformLabel(content.platform as BountySpreadPlatform)} · ${firstWords(content.title, 20)}`;
    }
  }

  return firstWords(b.query, 20) || b.query;
}

type QueryGroup = {
  query: string;
  bounties: BountyRow[];
};

function getBountyPlatforms(b: BountyRow): BountySpreadPlatform[] {
  const platforms = new Set<BountySpreadPlatform>();
  if (b.aeoPage) platforms.add("WEBSITE_BLOG");
  for (const content of b.contents ?? []) {
    const p = content.platform as BountySpreadPlatform;
    if (SPREAD_PLATFORM_OPTIONS.some((o) => o.value === p)) platforms.add(p);
  }
  return Array.from(platforms);
}

function groupBountiesByQuery(rows: BountyRow[]): QueryGroup[] {
  const map = new Map<string, QueryGroup>();
  for (const row of rows) {
    const key = row.query.trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.bounties.push(row);
    } else {
      map.set(key, { query: row.query.trim(), bounties: [row] });
    }
  }
  return Array.from(map.values());
}

function groupStatusMeta(bounties: BountyRow[]) {
  const statuses = bounties.map((b) => b.status?.toUpperCase());
  if (statuses.every((s) => s === "HUNTED")) return statusMeta("HUNTED");
  if (statuses.some((s) => s === "FAILED")) return statusMeta("FAILED");
  if (statuses.some((s) => s === "PENDING")) return statusMeta("PENDING");
  return statusMeta(bounties[0]?.status ?? "");
}

function statusMeta(status: string) {
  const s = status?.toUpperCase();
  if (s === "HUNTED")
    return {
      dot: "bg-emerald-500",
      badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    };
  if (s === "PENDING")
    return {
      dot: "bg-amber-500",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    };
  if (s === "FAILED")
    return {
      dot: "bg-red-500",
      badge: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
      bar: "bg-red-500",
    };
  return {
    dot: "bg-muted-foreground/40",
    badge: "border-[var(--glass-border)] bg-[var(--glass)] text-muted-foreground",
    bar: "bg-muted-foreground/30",
  };
}

function difficultyMeta(d: string) {
  const v = d?.toUpperCase();
  if (v === "EASY")
    return { badge: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400" };
  if (v === "MEDIUM")
    return { badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (v === "HARD")
    return { badge: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" };
  return { badge: "border-[var(--glass-border)] bg-[var(--glass)] text-muted-foreground" };
}

function ConfidenceRing({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color =
    pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--glass-border)]" />
        <circle
          cx="20" cy="20" r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums" style={{ color }}>{pct}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--glass-border)] bg-[var(--glass)]/80 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:border-[var(--sibling-primary)]/40 transition-all"
      title="Copy URL"
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Copied
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy
        </>
      )}
    </button>
  );
}

function contentStatusBadge(status: string) {
  const s = status?.toUpperCase();
  if (s === "PUBLISHED")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (s === "APPROVED")
    return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (s === "FAILED")
    return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function DistributionRow({ bountyId, page, contents }: { bountyId: string; page: AeoPageSummary | null; contents: BountyContentSummary[] }) {
  if (!page && contents.length === 0) return null;

  return (
    <div className="border-t border-[var(--glass-border)]/50 bg-[var(--glass)]/20 px-5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Distribution</p>
      <div className="flex flex-wrap gap-2">
        {page && (
          <Link
            href={`/organic/bounty/${bountyId}/hunt#content-WEBSITE_BLOG`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/80 px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:border-[var(--sibling-primary)]/40 transition-all"
          >
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${contentStatusBadge(page.publishedAt ? "PUBLISHED" : "DRAFT")}`}>
              {page.publishedAt ? "Published" : "Draft"}
            </span>
            Website (Blogs)
          </Link>
        )}
        {contents.map((c) => (
          <Link
            key={c.id}
            href={
              c.publishedUrl
                ? c.publishedUrl
                : `/organic/bounty/${bountyId}/hunt#content-${c.platform}`
            }
            target={c.publishedUrl ? "_blank" : undefined}
            rel={c.publishedUrl ? "noreferrer" : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/80 px-2.5 py-1.5 text-[10px] font-semibold text-foreground hover:border-[var(--sibling-primary)]/40 transition-all"
          >
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${contentStatusBadge(c.status)}`}>
              {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
            </span>
            {platformLabel(c.platform as BountySpreadPlatform)}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function BountySkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass-card rounded-xl border border-[var(--glass-border)] p-5 flex flex-col gap-4 border-l-4 border-l-[var(--glass-border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2.5">
              <div className="skeleton skeleton-heading w-2/3" />
              <div className="skeleton skeleton-text w-full" />
              <div className="skeleton skeleton-text w-4/5" />
            </div>
            <div className="skeleton skeleton-avatar w-10 h-10 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-7 w-28 rounded-lg" />
            <div className="skeleton h-7 w-36 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

const PAGE_SHELL = "w-full min-w-0 max-w-full pb-6 pt-2";

// ── Main component ────────────────────────────────────────────────────────────

export function BountyPagesClient() {
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPlatform, setFilterPlatform] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/geo/bounty-pages", { credentials: "include" });
        const data = (await res.json()) as { success?: boolean; bounties?: BountyRow[]; error?: string };
        if (cancelled) return;
        if (res.status === 401) { setUnauthenticated(true); return; }
        if (!res.ok) { setLoadError(data.error ?? "Failed to load bounty pages"); return; }
        if (data.success && Array.isArray(data.bounties)) {
          setBounties(data.bounties);
        } else {
          setLoadError("Invalid response");
        }
      } catch {
        if (!cancelled) setLoadError("Failed to load bounty pages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived filtered list
  const displayed = bounties.filter((b) => {
    const matchStatus = filterStatus === "ALL" || b.status?.toUpperCase() === filterStatus;
    const matchPlatform =
      filterPlatform === "ALL" || getBountyPlatforms(b).includes(filterPlatform as BountySpreadPlatform);
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      b.query.toLowerCase().includes(q) ||
      getBountyDisplayTitle(b).toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q);
    return matchStatus && matchPlatform && matchSearch;
  });

  const queryGroups = groupBountiesByQuery(displayed);
  const allQueryGroups = groupBountiesByQuery(bounties);

  const statuses = Array.from(
    new Set(
      bounties
        .map((b) => b.status?.toUpperCase())
        .filter((s): s is string => Boolean(s) && s !== "HUNTED"),
    ),
  );
  const platforms = Array.from(
    new Set(bounties.flatMap((b) => getBountyPlatforms(b))),
  ).sort(
    (a, b) =>
      SPREAD_PLATFORM_OPTIONS.findIndex((o) => o.value === a) -
      SPREAD_PLATFORM_OPTIONS.findIndex((o) => o.value === b),
  );

  // ── Loading
  if (loading) {
    return (
      <div className={`${PAGE_SHELL} min-h-[60vh]`}>
        <div className="mb-6">
          <div className="skeleton skeleton-heading w-64 mb-2" />
          <div className="skeleton skeleton-text w-40" />
        </div>
        {/* <LoadingAnimation text="Let me get those bounty pages for you..." />  */}
        Loading ...
      </div>
    );
  }

  // ── Auth error
  if (unauthenticated) {
    return (
      <div className={`${PAGE_SHELL} min-h-[60vh] flex flex-col items-center justify-center gap-4 pt-6`}>
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center text-muted-foreground/40">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Authentication required</p>
          <p className="text-xs text-muted-foreground mt-1">Sign in as a company user to view generated bounty pages.</p>
        </div>
      </div>
    );
  }

  // ── Load error
  if (loadError) {
    return (
      <div className={`${PAGE_SHELL} min-h-[60vh] flex flex-col items-center justify-center gap-4 pt-6`}>
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-red-500/30 bg-red-500/5 flex items-center justify-center text-red-500/60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Failed to load</p>
          <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${PAGE_SHELL} min-h-[60vh]`}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-accent)]">GEO · Bounty</p>
          </div>
          <h1 className="text-xl font-semibold text-foreground font-heading">Generated Pages</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allQueryGroups.length} quer{allQueryGroups.length === 1 ? "y" : "ies"} ·{" "}
            {bounties.length} hunt{bounties.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Stats strip */}
        {bounties.length > 0 && (
          <div className="flex gap-3">
            {[
              { label: "Total", value: bounties.length, color: "text-foreground" },
              {
                label: "Hunted",
                value: bounties.filter((b) => b.status?.toUpperCase() === "HUNTED").length,
                color: "text-emerald-500",
              },
              {
                label: "Pending",
                value: bounties.filter((b) => b.status?.toUpperCase() === "PENDING").length,
                color: "text-amber-500",
              },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-center min-w-[4.5rem]">
                <p className={`text-lg font-bold tabular-nums leading-none ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      {bounties.length > 0 && (
        <div className="mb-5 flex min-w-0 flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-full sm:max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/80 pl-8 pr-3 py-2 text-[12px] outline-none focus:border-[var(--sibling-primary)] transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Status filter pills */}
          {statuses.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === s ? "ALL" : s)}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1.5 border transition-all ${
                    filterStatus === s
                      ? "border-[var(--sibling-primary)] bg-[var(--sibling-primary)]/15 text-[var(--sibling-primary)]"
                      : "border-[var(--glass-border)] bg-[var(--glass)]/60 text-muted-foreground hover:text-foreground hover:border-[var(--sibling-primary)]/40"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          ) : null}

          {/* Platform filter pills */}
          {platforms.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterPlatform("ALL")}
                className={`text-[11px] font-semibold rounded-full px-3 py-1.5 border transition-all ${
                  filterPlatform === "ALL"
                    ? "border-[var(--sibling-primary)] bg-[var(--sibling-primary)]/15 text-[var(--sibling-primary)]"
                    : "border-[var(--glass-border)] bg-[var(--glass)]/60 text-muted-foreground hover:text-foreground hover:border-[var(--sibling-primary)]/40"
                }`}
              >
                All platforms
              </button>
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFilterPlatform(p)}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1.5 border transition-all ${
                    filterPlatform === p
                      ? "border-[var(--sibling-primary)] bg-[var(--sibling-primary)]/15 text-[var(--sibling-primary)]"
                      : "border-[var(--glass-border)] bg-[var(--glass)]/60 text-muted-foreground hover:text-foreground hover:border-[var(--sibling-primary)]/40"
                  }`}
                >
                  {platformLabel(p)}
                </button>
              ))}
            </div>
          ) : null}

          {/* Count */}
          <span className="w-full text-[11px] text-muted-foreground tabular-nums sm:ml-auto sm:w-auto">
            {queryGroups.length} quer{queryGroups.length === 1 ? "y" : "ies"} · {displayed.length} hunt{displayed.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {bounties.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 text-center py-16">
          <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center text-muted-foreground/30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="12" x2="12" y1="18" y2="12"/><line x1="9" x2="15" y1="15" y2="15"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No pages generated yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Use the Bounty section to run hunts — pages will appear here once generated.</p>
          </div>
        </div>
      ) : queryGroups.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center py-12">
          <p className="text-sm text-muted-foreground">No pages match your filters.</p>
          <button type="button" onClick={() => { setSearch(""); setFilterStatus("ALL"); setFilterPlatform("ALL"); }} className="text-[11px] text-[var(--sibling-primary)] hover:underline">Clear filters</button>
        </div>
      ) : (

        /* ── Grouped by query ─────────────────────────────────────────── */
        <div className="space-y-4">
          {queryGroups.map((group) => {
            const gm = groupStatusMeta(group.bounties);
            const maxConfidence = Math.max(...group.bounties.map((b) => b.confidence));
            const huntCount = group.bounties.length;

            return (
              <div
                key={group.query.toLowerCase()}
                className={`glass-card rounded-xl border border-[var(--glass-border)] border-l-4 overflow-hidden ${gm.bar}`}
              >
                <div className="border-b border-[var(--glass-border)]/50 bg-[var(--glass)]/25 px-5 py-4">
                  <div className="flex items-start gap-4 justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--sibling-primary)]/70 mb-1.5">
                        Query
                      </p>
                      <h2 className="text-sm font-semibold text-foreground leading-snug">{group.query}</h2>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        {huntCount} hunt{huntCount !== 1 ? "s" : ""} ·{" "}
                        {group.bounties.reduce((n, b) => n + (b.contents?.length ?? 0) + (b.aeoPage ? 1 : 0), 0)}{" "}
                        platform
                        {group.bounties.reduce((n, b) => n + (b.contents?.length ?? 0) + (b.aeoPage ? 1 : 0), 0) !== 1
                          ? "s"
                          : ""}
                      </p>
                    </div>
                    <ConfidenceRing value={maxConfidence} />
                  </div>
                </div>

                <div className="divide-y divide-[var(--glass-border)]/50">
                  {group.bounties.map((b) => {
                    const page = b.aeoPage;
                    const contents = b.contents ?? [];
                    const sm = statusMeta(b.status);
                    const dm = difficultyMeta(b.difficulty);

                    return (
                      <div key={b.id} className="bg-[var(--glass)]/10">
                        <div className="p-5 flex flex-col gap-4">
                          <div className="flex items-start gap-4 justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-medium text-foreground leading-snug">
                                {getBountyDisplayTitle(b)}
                              </h3>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground/60 bg-[var(--glass-border)]/30 px-1.5 py-0.5 rounded">
                                  {b.id}
                                </span>
                                {page?.publishedAt && (
                                  <span className="text-[10px] text-muted-foreground/60">
                                    ·{" "}
                                    {new Date(page.publishedAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ConfidenceRing value={b.confidence} />
                          </div>

                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full border px-2.5 py-1 ${sm.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                              {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                            </span>
                            <span className={`text-[11px] font-semibold rounded-full border px-2.5 py-1 ${dm.badge}`}>
                              {b.difficulty.charAt(0) + b.difficulty.slice(1).toLowerCase()}
                            </span>
                            {page?.pageType && (
                              <span className="text-[11px] font-medium rounded-full border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-1 text-muted-foreground">
                                {page.pageType.replace(/_/g, " ")}
                              </span>
                            )}
                            {page?.locale && (
                              <span className="text-[11px] font-medium rounded-full border border-[var(--glass-border)] bg-[var(--glass)]/70 px-2.5 py-1 text-muted-foreground uppercase tracking-wider">
                                {page.locale}
                              </span>
                            )}
                          </div>
                        </div>

                        <DistributionRow bountyId={b.id} page={page} contents={contents} />

                        <div className="border-t border-[var(--glass-border)]/50 bg-[var(--glass)]/30 px-5 py-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/organic/bounty/${b.id}/hunt`}
                              className="glass-button-primary inline-flex items-center gap-1.5 text-[11px] font-semibold py-1.5 px-3.5 active:scale-[0.98] transition-all"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                              View generated hunt
                            </Link>

                            {page?.canonicalUrl && (
                              <a
                                href={page.canonicalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/80 px-3.5 py-1.5 text-[11px] font-semibold text-foreground hover:border-[var(--sibling-primary)]/40 hover:bg-[var(--glass-hover)] active:scale-[0.98] transition-all"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                </svg>
                                Open canonical URL
                              </a>
                            )}
                          </div>

                          {page?.canonicalUrl && (
                            <div className="flex min-w-0 w-full items-center gap-2 sm:flex-1">
                              <code className="min-w-0 flex-1 truncate text-[10px] font-mono text-muted-foreground/60">
                                {page.canonicalUrl}
                              </code>
                              <CopyButton text={page.canonicalUrl} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}