"use client";

import { FileUploadState } from "@/app/hooks/useUploader";
import { cn } from "@/lib/tailwind";

interface Props {
  files: FileUploadState[];
}

export function UploadSummaryBar({ files }: Props) {
  if (!files.length) return null;

  const uploading = files.filter((f) => f.status === "uploading").length;
  const processing = files.filter((f) => f.status === "processing").length;
  const ready = files.filter((f) => f.status === "ready").length;
  const error = files.filter((f) => f.status === "error").length;
  const total = files.length;

  // Overall upload progress (average across uploading files)
  const avgProgress =
    files.reduce((sum, f) => sum + (f.progress ?? 0), 0) / total;

  const isActive = uploading > 0 || processing > 0;
  const allDone = ready + error === total;

  if (!isActive && !allDone) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-4 px-5 py-3 rounded-2xl",
        "transition-all duration-500 animate-fade-up",
        "glass-modal min-w-[320px] max-w-[480px] w-full mx-4"
      )}
    >
      {/* Overall bar */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {allDone
              ? `${ready}/${total} uploaded`
              : isActive
              ? `Uploading ${total} file${total > 1 ? "s" : ""}…`
              : ""}
          </span>
          {isActive && (
            <span
              className="text-xs font-data"
              style={{ color: "var(--clipfox-primary)" }}
            >
              {Math.round(avgProgress)}%
            </span>
          )}
        </div>

        {/* Segmented progress */}
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-border/40">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-500 ease-out"
              style={{
                background:
                  f.status === "ready"
                    ? "var(--clipfox-primary)"
                    : f.status === "error"
                    ? "var(--destructive)"
                    : f.status === "processing"
                    ? "#f59e0b"
                    : f.status === "uploading"
                    ? `linear-gradient(90deg, var(--clipfox-primary) ${f.progress}%, var(--border) ${f.progress}%)`
                    : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* Counts */}
        <div
          className="flex items-center gap-3 text-xs text-muted-foreground"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          {uploading > 0 && (
            <span style={{ color: "var(--clipfox-primary)" }}>
              {uploading} uploading
            </span>
          )}
          {processing > 0 && (
            <span className="text-amber-500">{processing} processing</span>
          )}
          {ready > 0 && (
            <span className="text-emerald-500">{ready} ready</span>
          )}
          {error > 0 && (
            <span className="text-destructive">{error} failed</span>
          )}
        </div>
      </div>
    </div>
  );
}