"use client";

import { useState, useEffect } from "react";
import type { BountySpreadPlatform } from "@/app/generated/prisma/client";
import type { BountyNiche, BountyNichePrompt } from "./bounty-table";
import { RevenueChip } from "@/app/components/geo/revenue-chip";
import {
  ALL_SPREAD_PLATFORMS,
  DEFAULT_SPREAD_PLATFORMS,
  SPREAD_PLATFORM_OPTIONS,
  platformLabel,
} from "@/lib/geo/bounty/spread-platforms";

type BountyPromptsModalProps = {
  bounty: BountyNiche | null;
  onClose: () => void;
};

type PlatformResult = {
  platform: BountySpreadPlatform;
  success: boolean;
  error?: string;
};

function togglePlatform(
  selected: BountySpreadPlatform[],
  platform: BountySpreadPlatform,
  nextOn?: boolean
): BountySpreadPlatform[] {
  const set = new Set(selected);
  const on = nextOn ?? !set.has(platform);
  if (on) set.add(platform);
  else set.delete(platform);
  return ALL_SPREAD_PLATFORMS.filter((p) => set.has(p));
}

function SpreadPlatformCheckboxGroup({
  selected,
  onChange,
}: {
  selected: BountySpreadPlatform[];
  onChange: (next: BountySpreadPlatform[]) => void;
}) {
  const allSelected = ALL_SPREAD_PLATFORMS.every((p) => selected.includes(p));
  const chipBase =
    "flex cursor-pointer select-none items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight transition";

  return (
    <>
      <label
        className={`${chipBase} border-[var(--glass-border)]/70 bg-[var(--glass)]/40 text-muted-foreground hover:border-[var(--sibling-primary)]/40`}
      >
        <input
          type="checkbox"
          className="h-2.5 w-2.5 shrink-0 rounded border-[var(--glass-border)]"
          checked={allSelected}
          onChange={(e) => {
            onChange(e.target.checked ? [...ALL_SPREAD_PLATFORMS] : []);
          }}
        />
        <span className="text-foreground">All</span>
      </label>
      {SPREAD_PLATFORM_OPTIONS.map((opt) => {
        const checked = selected.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={`${chipBase} ${
              checked
                ? "border-[var(--sibling-primary)]/50 bg-[var(--sibling-primary)]/10 text-foreground"
                : "border-[var(--glass-border)]/70 bg-[var(--glass)]/40 text-muted-foreground hover:border-[var(--sibling-primary)]/40"
            }`}
          >
            <input
              type="checkbox"
              className="h-2.5 w-2.5 shrink-0 rounded border-[var(--glass-border)]"
              checked={checked}
              onChange={(e) => onChange(togglePlatform(selected, opt.value, e.target.checked))}
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </>
  );
}

export function BountyPromptsModal({ bounty, onClose }: BountyPromptsModalProps) {
  useEffect(() => {
    if (!bounty) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [bounty, onClose]);

  if (!bounty) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bounty-modal-title"
    >
      <div
        className="flex w-full max-w-2xl max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)]/80 bg-[var(--glass-bg-solid)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--glass-border)]/80 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="bounty-modal-title" className="text-lg font-semibold text-foreground">
              {bounty.topic}
            </h2>
            {bounty.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {bounty.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-full p-2 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 glass-scrollbar">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Prompts ({bounty.prompts.length})
          </p>
          <ul className="space-y-3">
            {bounty.prompts
              .filter((p): p is BountyNichePrompt => Boolean(p?.id && typeof p.query === "string"))
              .map((p) => (
                <li key={p.id}>
                  <GetCitedRow prompt={p} />
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GetCitedRow({ prompt }: { prompt: BountyNichePrompt }) {
  const query = prompt?.query?.trim() ?? "";
  const [platforms, setPlatforms] = useState<BountySpreadPlatform[]>(DEFAULT_SPREAD_PLATFORMS);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [platformResults, setPlatformResults] = useState<PlatformResult[]>([]);

  if (!prompt || !query) return null;

  const handleGetCited = async () => {
    if (platforms.length === 0) {
      setMessage("Select at least one platform.");
      setState("error");
      return;
    }

    setState("loading");
    setMessage(null);
    setPlatformResults([]);

    try {
      const res = await fetch("/api/geo/bounty/get-cited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, promptId: prompt.id, platforms }),
      });
      const data = await res.json();

      const results = Array.isArray(data?.results) ? (data.results as PlatformResult[]) : [];
      setPlatformResults(results);

      if (!res.ok || !data?.success) {
        setState("error");
        setMessage(data?.error ?? "Failed to get cited");
        return;
      }

      setState("success");
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        setMessage(
          `Content generated with ${failed.length} platform warning${failed.length === 1 ? "" : "s"}. View in Bounty Pages.`
        );
      } else {
        setMessage("Content created for all selected platforms. View in Bounty Pages.");
      }
    } catch (err) {
      console.error("Get cited error", err);
      setState("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--glass-border)]/70 bg-[var(--glass)]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground min-w-0 flex-1">{query}</p>
        <RevenueChip
          amount={prompt.resolvedRevenue ?? 0}
          tooltipTitle="Prompt revenue estimate"
          breakdown={prompt.revenueBreakdown ?? undefined}
          size="sm"
        />
      </div>

      <div className="font-ui flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleGetCited}
          disabled={state === "loading" || platforms.length === 0}
          className="glass-button-primary inline-flex shrink-0 items-center gap-1 text-[10px] font-medium tracking-wide py-1 px-2 disabled:opacity-60"
        >
          {state === "loading" ? (
            <>
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Running…
            </>
          ) : (
            "Get Cited"
          )}
        </button>
        <span className="hidden h-3 w-px shrink-0 bg-[var(--glass-border)]/80 sm:block" aria-hidden />
        <SpreadPlatformCheckboxGroup selected={platforms} onChange={setPlatforms} />
        {message && (
          <span
            className={`text-[10px] ${
              state === "success" ? "text-[var(--success)]" : "text-destructive"
            }`}
          >
            {message}
          </span>
        )}
      </div>

      {platformResults.length > 0 && (
        <div className="font-ui flex flex-wrap gap-1">
          {platformResults.map((r) => (
            <span
              key={r.platform}
              className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${
                r.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
              title={r.error ?? undefined}
            >
              {platformLabel(r.platform)}: {r.success ? "OK" : "Failed"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
