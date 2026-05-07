'use client';

import { useCallback, useMemo, useState } from 'react';

import { useUploader } from '@/app/hooks/useUploader';

export default function UploadStep({
  companyId,
  onUploaded,
  onError,
}: {
  companyId: string;
  onUploaded: (input: { bulkUploadId: string; assetIds: string[] }) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [bulkUploadId, setBulkUploadId] = useState<string>('');
  const { files, uploadWithBulkId } = useUploader(companyId, (id) => setBulkUploadId(id));

  // Only block on actual multipart uploading — not on video stream encoding.
  const anyUploading = useMemo(
    () => files.some((f) => f.status === 'uploading'),
    [files],
  );

  const onPickFiles = useCallback(async (picked: FileList | null) => {
    if (!picked?.length) return;
    setBusy(true);
    try {
      const selected = Array.from(picked);
      const { bulkUploadId: id, assetIds } = await uploadWithBulkId(
        selected,
        { bulkName: `Create Ad · ${new Date().toLocaleString()}` },
      );
      const okAssetIds = assetIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (!id) throw new Error('Missing bulkUploadId');
      setBulkUploadId(id);

      // Kick off analysis in the background — do NOT await.
      // Videos may still be encoding on Cloudflare Stream; the Groups step
      // will poll until buckets are ready.
      void fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'content' }),
      });

      // Advance immediately — Groups step handles the "still analyzing" state.
      onUploaded({ bulkUploadId: id, assetIds: okAssetIds });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }, [uploadWithBulkId, onUploaded, onError]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/40 bg-background/20 p-5">
        <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Upload creatives
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a batch of images/videos for this ad. We’ll auto-group them into creative sets.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="glass-button-primary inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            <input
              type="file"
              className="sr-only"
              multiple
              accept="image/*,video/*"
              disabled={busy || anyUploading}
              onChange={(e) => void onPickFiles(e.target.files)}
            />
            {busy || anyUploading ? 'Uploading…' : 'Select files'}
          </label>
          {bulkUploadId ? (
            <span className="glass-badge text-xs">Batch: {bulkUploadId}</span>
          ) : null}
        </div>
      </div>

      {files.length > 0 ? (
        <div className="rounded-2xl border border-border/40 bg-background/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Upload progress
            </p>
            <span className="glass-badge">{files.length} file{files.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-border/30">
            {files.map((f) => (
              <div key={`${f.file.name}-${f.file.size}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.status.toUpperCase()} · {f.progress}%
                    </p>
                    {f.error ? (
                      <p className="mt-1 text-[11px] text-destructive">{f.error}</p>
                    ) : null}
                  </div>
                  <div className="w-40">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, f.progress))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

