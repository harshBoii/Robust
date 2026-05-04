"use client";

import { useMemo } from "react";
import { FileUploadState } from "@/app/hooks/useUploader";
import { ExternalLink, AlertCircle, Loader2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/tailwind";

interface FileCardProps {
  fileState: FileUploadState;
  index: number;
}

const STATUS_CONFIG = {
  idle: {
    label: "Queued",
    icon: Clock,
    color: "text-muted-foreground",
    badge: "text-muted-foreground bg-muted/60",
    bar: "bg-muted-foreground/30",
  },
  uploading: {
    label: "Uploading",
    icon: Loader2,
    color: "text-[--clipfox-primary]",
    badge: "text-[--clipfox-primary]",
    bar: "bg-[--clipfox-primary]",
  },
  processing: {
    label: "Processing Stream",
    icon: Loader2,
    color: "text-amber-500 dark:text-amber-400",
    badge: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
    bar: "bg-amber-400 dark:bg-amber-500 animate-pulse",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    color: "text-emerald-500",
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    bar: "bg-emerald-500",
  },
  error: {
    label: "Failed",
    icon: AlertCircle,
    color: "text-destructive",
    badge: "text-destructive bg-destructive/8",
    bar: "bg-destructive",
  },
} as const;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileThumbnail({ file, thumbnailUrl }: { file: File; thumbnailUrl?: string }) {
  const isVideo = file.type.startsWith("video/");
  const localPreview = useMemo(
    () => (!isVideo && !thumbnailUrl ? URL.createObjectURL(file) : null),
    [file, isVideo, thumbnailUrl]
  );

  const src = thumbnailUrl ?? localPreview;

  return (
    <div
      className="relative w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={file.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-xl select-none">
          {isVideo ? "🎬" : "🖼️"}
        </span>
      )}
      {/* Overlay shimmer for processing state */}
      {!src && isVideo && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "linear-gradient(135deg, var(--clipfox-primary-light), var(--clipfox-accent))",
          }}
        />
      )}
    </div>
  );
}

export function FileCard({ fileState, index }: FileCardProps) {
  const { file, progress, status, thumbnailUrl, playbackUrl, error } = fileState;
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const isVideo = file.type.startsWith("video/");

  // Progress bar fill: processing = indeterminate (100% width + pulsing)
  const barWidth =
    status === "processing" ? 100
    : status === "ready" ? 100
    : status === "error" ? 100
    : progress;

  return (
    <div
      className={cn(
        "glass-card group flex items-center gap-3.5 p-3.5 transition-all duration-300",
        "animate-fade-up"
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Thumbnail */}
      <FileThumbnail file={file} thumbnailUrl={thumbnailUrl} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: name + status badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className="text-sm font-medium text-foreground truncate leading-none"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {file.name}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusIcon
              className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.color,
                (status === "uploading" || status === "processing") && "animate-spin"
              )}
              strokeWidth={2}
            />
            <span
              className={cn(
                "glass-badge text-[0.65rem] px-2 py-0.5 flex-shrink-0",
                cfg.badge
              )}
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs text-muted-foreground font-data"
          >
            {formatBytes(file.size)}
          </span>
          <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
          <span
            className="text-xs text-muted-foreground"
            style={{ fontFamily: "var(--font-accent)" }}
          >
            {isVideo ? "Video" : "Image"}
          </span>
          {status === "uploading" && (
            <>
              <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
              <span
                className="text-xs font-medium font-data"
                style={{ color: "var(--clipfox-primary)" }}
              >
                {progress}%
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-1 bg-border/60 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500 ease-out", cfg.bar)}
            style={{ width: `${barWidth}%` }}
          />
          {/* Shine sweep on uploading */}
          {status === "uploading" && (
            <div
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                animation: "shimmer 1.2s ease-in-out infinite",
              }}
            />
          )}
        </div>

        {/* Bottom label */}
        <div className="mt-1.5 min-h-[16px]">
          {status === "processing" && (
            <p
              className="text-xs text-amber-500 dark:text-amber-400"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Queued for Cloudflare Stream · Processing…
            </p>
          )}

          {status === "ready" && playbackUrl && isVideo && (
            <a
              href={playbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium hover:underline transition-colors"
              style={{ color: "var(--clipfox-primary)", fontFamily: "var(--font-accent)" }}
            >
              <span>▶ Stream ready</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {status === "ready" && !isVideo && (
            <p
              className="text-xs text-emerald-500"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              Uploaded to R2 ✓
            </p>
          )}

          {status === "error" && (
            <p
              className="text-xs text-destructive truncate"
              style={{ fontFamily: "var(--font-accent)" }}
            >
              {error ?? "Upload failed. Please retry."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}