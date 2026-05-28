"use client";

import { useState, useEffect } from "react";
import type { BountyNiche, BountyNichePrompt } from "./bounty-table";
import { RevenueChip } from "@/app/components/geo/revenue-chip";

type BountyPromptsModalProps = {
  bounty: BountyNiche | null;
  onClose: () => void;
};

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
  if (!prompt || !query) return null;
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleGetCited = async () => {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/geo/bounty/get-cited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, promptId: prompt.id }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        setState("error");
        setMessage(data?.error ?? "Failed to get cited");
        return;
      }
      setState("success");
      setMessage("AEO page created. You can view it in your AEO pages.");
    } catch (err) {
      console.error("Get cited error", err);
      setState("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--glass-border)]/70 bg-[var(--glass)]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground min-w-0 flex-1">{query}</p>
        <RevenueChip
          amount={prompt.resolvedRevenue ?? 0}
          tooltipTitle="Prompt revenue estimate"
          breakdown={prompt.revenueBreakdown ?? undefined}
          size="sm"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleGetCited}
          disabled={state === "loading"}
          className="btn-primary inline-flex items-center gap-1.5 text-sm py-1.5 px-3"
        >
          {state === "loading" ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Running…
            </>
          ) : (
            "Get Cited"
          )}
        </button>
        {message && (
          <span
            className={`text-xs ${
              state === "success" ? "text-[var(--success)]" : "text-destructive"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
