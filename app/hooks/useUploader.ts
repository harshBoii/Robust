import { useState, useCallback, useRef } from "react";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export type FileUploadStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export interface FileUploadState {
  file: File;
  progress: number;
  status: FileUploadStatus;
  assetId?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

// ─── Debug logger ─────────────────────────────────────────────────────────────
const tag = (step: string) => `[useUploader:${step}]`;

function logStep(step: string, msg: string, data?: unknown) {
  const prefix = `%c${tag(step)}`;
  const style = "color: #7c5cbf; font-weight: bold;";
  if (data !== undefined) {
    console.log(prefix, style, msg, data);
  } else {
    console.log(prefix, style, msg);
  }
}

function logOk(step: string, msg: string, data?: unknown) {
  const prefix = `%c${tag(step)} ✅`;
  const style = "color: #22c55e; font-weight: bold;";
  if (data !== undefined) {
    console.log(prefix, style, msg, data);
  } else {
    console.log(prefix, style, msg);
  }
}

function logErr(step: string, msg: string, data?: unknown) {
  const prefix = `%c${tag(step)} ❌`;
  const style = "color: #ef4444; font-weight: bold;";
  if (data !== undefined) {
    console.error(prefix, style, msg, data);
  } else {
    console.error(prefix, style, msg);
  }
}

async function safeJson(res: Response, label: string) {
  const text = await res.text();
  logStep(label, `Raw response (${res.status}):`, text.slice(0, 500));
  try {
    return JSON.parse(text);
  } catch {
    logErr(label, "Could not parse response as JSON", text);
    throw new Error(`${label}: non-JSON response (${res.status})`);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUploader(
  companyId: string,
  onUploadStart?: (bulkUploadId: string) => void
) {
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const sseRef = useRef<EventSource | null>(null);
  const startFiredRef = useRef(false);

  const updateFile = (index: number, patch: Partial<FileUploadState>) =>
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );

  const uploadFile = useCallback(
    async (file: File, index: number, bulkUploadId: string) => {
      const label = `file[${index}]:${file.name}`;
      logStep(label, `Starting upload`, {
        name: file.name,
        size: file.size,
        type: file.type,
        bulkUploadId,
      });

      try {
        updateFile(index, { status: "uploading", progress: 0 });

        const totalParts = Math.ceil(file.size / CHUNK_SIZE);
        logStep(label, `Total parts: ${totalParts} (file size: ${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // ── 1. Start multipart ────────────────────────────────────────────────
        logStep(label, "POST /api/upload/start ...");
        const startRes = await fetch("/api/upload/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            totalParts,
            companyId,
            bulkUploadId,
          }),
        });

        const startData = await safeJson(startRes, `${label}:start`);

        if (!startRes.ok) {
          logErr(label, "POST /api/upload/start failed", startData);
          throw new Error(startData?.error ?? "Failed to start upload");
        }

        logOk(label, "Upload session created", startData);
        const { sessionId, r2Key } = startData;

        // ── 2. Upload parts ───────────────────────────────────────────────────
        const parts: { ETag: string; PartNumber: number }[] = [];

        for (let i = 0; i < totalParts; i++) {
          const partNumber = i + 1;
          const start = i * CHUNK_SIZE;
          const chunk = file.slice(start, start + CHUNK_SIZE);

          logStep(
            label,
            `Part ${partNumber}/${totalParts}: getting presigned URL`,
            { chunkSize: chunk.size, start }
          );

          // Get presigned URL
          const partRes = await fetch("/api/upload/part", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, partNumber }),
          });

          const partData = await safeJson(partRes, `${label}:part-url-${partNumber}`);

          if (!partRes.ok) {
            logErr(label, `Failed to get presigned URL for part ${partNumber}`, partData);
            throw new Error(partData?.error ?? `Failed to get presigned URL for part ${partNumber}`);
          }

          const { presignedUrl } = partData;
          logOk(label, `Part ${partNumber}: got presigned URL`, {
            urlPrefix: presignedUrl.slice(0, 80) + "…",
          });

          // PUT chunk directly to R2
          logStep(label, `Part ${partNumber}: PUT to R2 (${(chunk.size / 1024).toFixed(0)} KB)…`);

          const controller = new AbortController();
          const timeout = setTimeout(() => {
            logErr(label, `Part ${partNumber}: PUT timed out after 60s`);
            controller.abort();
          }, 60_000);

          let r2Res: Response;
          try {
            r2Res = await fetch(presignedUrl, {
              method: "PUT",
              body: chunk,
              signal: controller.signal,
              // ✅ NO Content-Type header — causes SignatureDoesNotMatch on R2
            });
          } finally {
            clearTimeout(timeout);
          }

          logStep(
            label,
            `Part ${partNumber}: R2 PUT response`,
            {
              status: r2Res.status,
              statusText: r2Res.statusText,
              headers: {
                ETag: r2Res.headers.get("ETag"),
                "Content-Type": r2Res.headers.get("Content-Type"),
                "x-amz-request-id": r2Res.headers.get("x-amz-request-id"),
              },
            }
          );

          if (!r2Res.ok) {
            const errBody = await r2Res.text();
            logErr(label, `Part ${partNumber}: R2 PUT failed`, {
              status: r2Res.status,
              body: errBody.slice(0, 500),
            });
            throw new Error(`Part ${partNumber} R2 upload failed (${r2Res.status}): ${errBody.slice(0, 200)}`);
          }

          const rawETag = r2Res.headers.get("ETag") ?? r2Res.headers.get("etag") ?? "";
          logOk(label, `Part ${partNumber}: PUT succeeded`, { rawETag });

          if (!rawETag) {
            logErr(
              label,
              `Part ${partNumber}: ETag is empty — CORS may be missing "ExposeHeaders: ETag" on R2 bucket`,
            );
          }

          // Normalize ETag — R2 returns quoted, AWS SDK expects quoted
          const etag = rawETag.startsWith('"') ? rawETag : `"${rawETag}"`;
          parts.push({ ETag: etag, PartNumber: partNumber });

          updateFile(index, {
            progress: Math.round(((i + 1) / totalParts) * 100),
          });
        }

        logOk(label, "All parts uploaded", { parts });

        // ── 3. Complete multipart ─────────────────────────────────────────────
        logStep(label, "POST /api/upload/complete …", { sessionId, partCount: parts.length });

        const completeRes = await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, parts }),
        });

        const completeData = await safeJson(completeRes, `${label}:complete`);

        if (!completeRes.ok) {
          logErr(label, "POST /api/upload/complete failed", completeData);
          throw new Error(completeData?.error ?? "Failed to complete upload");
        }

        logOk(label, "Upload complete!", completeData);
        const { assetId, assetType } = completeData;

        updateFile(index, {
          assetId,
          status: assetType === "VIDEO" ? "processing" : "ready",
          progress: 100,
        });

        return assetId as string;
      } catch (err) {
        const message = (err as Error).message;
        logErr(label, "Upload failed", message);
        updateFile(index, { status: "error", error: message });
        return null;
      }
    },
    [companyId]
  );

  // ── SSE ─────────────────────────────────────────────────────────────────────
  const startSSE = useCallback((assetIds: string[]) => {
    if (sseRef.current) sseRef.current.close();

    logStep("SSE", "Starting SSE for assets", assetIds);
    const sse = new EventSource(`/api/assets/status?ids=${assetIds.join(",")}`);

    sse.onopen = () => logOk("SSE", "Connection opened");

    sse.onmessage = (e) => {
      logStep("SSE", "Message received", e.data);
      const data = JSON.parse(e.data);

      if (data.done) {
        logOk("SSE", "All assets terminal — closing connection");
        sse.close();
        return;
      }

      if (data.assets) {
        setFiles((prev) =>
          prev.map((f) => {
            const updated = data.assets.find(
              (a: { id: string }) => a.id === f.assetId
            );
            if (!updated) return f;
            logStep("SSE", `Asset ${updated.id} status → ${updated.status}`);
            return {
              ...f,
              status:
                updated.status === "READY" ? "ready"
                : updated.status === "ERROR" ? "error"
                : "processing",
              playbackUrl: updated.playbackUrl ?? f.playbackUrl,
              thumbnailUrl: updated.thumbnailUrl ?? f.thumbnailUrl,
            };
          })
        );
      }
    };

    sse.onerror = (e) => {
      logErr("SSE", "Connection error", e);
    };

    sseRef.current = sse;
  }, []);

  // ── Main upload entry ────────────────────────────────────────────────────────
  const upload = useCallback(
    async (selectedFiles: File[]) => {
      startFiredRef.current = false;

      logStep("bulk", `Starting batch upload of ${selectedFiles.length} file(s)`);

      // 1. Create BulkUpload record
      logStep("bulk", "POST /api/upload/bulk-start …");
      const bulkRes = await fetch("/api/upload/bulk-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: `Upload ${new Date().toLocaleString()}`,
        }),
      });

      const bulkData = await safeJson(bulkRes, "bulk-start");

      if (!bulkRes.ok) {
        logErr("bulk", "POST /api/upload/bulk-start failed", bulkData);
        throw new Error(bulkData?.error ?? "Failed to create bulk upload");
      }

      const { bulkUploadId } = bulkData;
      logOk("bulk", "BulkUpload created", { bulkUploadId });

      // 2. Fire callback
      if (!startFiredRef.current) {
        startFiredRef.current = true;
        onUploadStart?.(bulkUploadId);
      }

      // 3. Init UI state
      setFiles(
        selectedFiles.map((file) => ({
          file,
          progress: 0,
          status: "idle" as FileUploadStatus,
        }))
      );

      // 4. Upload all concurrently
      logStep("bulk", "Uploading all files concurrently…");
      const assetIds = await Promise.all(
        selectedFiles.map((file, index) =>
          uploadFile(file, index, bulkUploadId)
        )
      );

      logOk("bulk", "All uploads settled", { assetIds });

      // 5. SSE for videos only
      const videoIds = selectedFiles
        .map((f, i) => (f.type.startsWith("video/") ? assetIds[i] : null))
        .filter((id): id is string => id !== null);

      if (videoIds.length > 0) {
        logStep("bulk", "Starting SSE for video assets", videoIds);
        startSSE(videoIds);
      }

      return assetIds;
    },
    [companyId, onUploadStart, uploadFile, startSSE]
  );

  return { files, upload };
}