"use client";

import { RunScanButton } from "./run-scan-button";

type BountyHeaderProps = {
  status?: "idle" | "developing" | "ready";
  scanInProgress?: boolean;
};

export function BountyHeader({ status = "idle", scanInProgress }: BountyHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          Bounty
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Discover niches and prompts from the bounty microservice. Run a scan to fetch and save topics.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-3 py-1.5 text-xs font-medium text-muted-foreground"
          aria-hidden
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {status === "ready" ? "Ready" : status === "developing" ? "Developing" : "Idle"}
        </span>
        <RunScanButton onSuccess={() => {}} scanInProgress={scanInProgress} />
      </div>
    </div>
  );
}
