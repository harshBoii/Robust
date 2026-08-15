"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUploader } from "@/app/hooks/useUploader";
import { FileCard } from "../upload/FileCard";
import { Upload, Plus } from "lucide-react";

interface UploadZoneProps {
  companyId: string;
  onUploadStart?: (bulkUploadId: string) => void;
}

export function UploadZone({ companyId, onUploadStart }: UploadZoneProps) {
  const { files, upload, clear } = useUploader(companyId, onUploadStart);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (selected: FileList | null) => {
      if (!selected?.length) return;
      upload(Array.from(selected));
    },
    [upload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const hasFiles = files.length > 0;
  const isUploading = files.some(
    (f) => f.status === "uploading" || f.status === "processing"
  );
  const allDone =
    hasFiles && files.every((f) => f.status === "ready" || f.status === "error");
  const readyCount = files.filter((f) => f.status === "ready").length;
  const [refreshIn, setRefreshIn] = useState<number | null>(null);

  useEffect(() => {
    if (!allDone) {
      setRefreshIn(null);
      return;
    }

    setRefreshIn(15);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const remaining = Math.max(
        0,
        15 - Math.round((Date.now() - startedAt) / 1000),
      );
      setRefreshIn(remaining);
      if (remaining === 0) {
        window.clearInterval(tick);
        window.dispatchEvent(new Event("robust-gallery-refresh"));
        clear();
      }
    }, 250);

    return () => window.clearInterval(tick);
  }, [allDone, clear]);

  return (
    <div className="w-full space-y-4 animate-fade-up">
      {/* ── Drop Zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isUploading && inputRef.current?.click()}
        className="relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-4 py-14 px-8 text-center before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none"
        style={{
          borderColor: isDragging
            ? "var(--clipfox-primary)"
            : "var(--border)",
          background: isDragging
            ? "rgba(215,118,90,0.06)"
            : "var(--glass-bg)",
          backdropFilter: "blur(var(--glass-blur))",
          WebkitBackdropFilter: "blur(var(--glass-blur))",
          boxShadow: isDragging ? "var(--glow-primary)" : "var(--glass-shadow)",
          transform: isDragging ? "scale(1.01)" : "scale(1)",
          cursor: isUploading ? "not-allowed" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isUploading}
        />

        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isDragging ? "scale-110 animate-pulse-glow" : "animate-float"}`}
          style={{
            background: "linear-gradient(135deg, var(--clipfox-primary-light), var(--clipfox-primary-dark))",
            boxShadow: "var(--glow-primary)",
          }}
        >
          <Upload className="w-7 h-7 text-white" strokeWidth={1.8} />
        </div>

        <div className="space-y-1.5">
          <p className="text-base font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {isUploading ? "Upload in progress…" : isDragging ? "Drop to upload" : "Drop files here, or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-accent)" }}>
            Videos and images · Multiple files supported
          </p>
        </div>

        {!isUploading && (
          <button
            className="glass-button-primary px-5 py-2.5 text-sm font-medium rounded-xl text-white pointer-events-none"
            tabIndex={-1}
          >
            Choose files
          </button>
        )}

        {isDragging && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(215,118,90,0.08) 50%, transparent 100%)",
              animation: "shimmer 1.5s ease-in-out infinite",
            }}
          />
        )}
      </div>

      {/* ── File List ── */}
      {hasFiles && (
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {files.length} file{files.length > 1 ? "s" : ""}
              </span>
              {isUploading && (
                <span className="glass-badge" style={{ color: "var(--clipfox-primary)" }}>
                  Uploading
                </span>
              )}
              {allDone && (
                <span className="glass-badge" style={{ color: "var(--clipfox-primary)" }}>
                  {readyCount}/{files.length} ready
                </span>
              )}
              {allDone && refreshIn != null && refreshIn > 0 && (
                <span className="text-xs text-muted-foreground">
                  This message goes in {refreshIn}s
                </span>
              )}
            </div>
            {allDone && (
              <button
                onClick={() => inputRef.current?.click()}
                className="glass-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add more
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {files.map((f, i) => (
              <FileCard key={`${f.file.name}-${i}`} fileState={f} index={i} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}