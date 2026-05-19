'use client';

import { useCallback, useMemo, useState } from 'react';

import { useUploader } from '@/app/hooks/useUploader';
import { waitForAssetsReady } from '@/lib/gallery/wait-for-assets-ready';

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
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing' | 'analyzing'>('idle');
  const [bulkUploadId, setBulkUploadId] = useState<string>('');
  const { files, uploadWithBulkId } = useUploader(companyId, (id) => setBulkUploadId(id));

  /* ── derived progress info ── */
  const videoFiles = useMemo(() => files.filter((f) => f.file.type.startsWith('video/')), [files]);
  const imageFiles = useMemo(() => files.filter((f) => f.file.type.startsWith('image/')), [files]);
  const videosReady = useMemo(() => videoFiles.filter((f) => f.status === 'ready').length, [videoFiles]);
  const videosErrored = useMemo(() => videoFiles.filter((f) => f.status === 'error').length, [videoFiles]);
  const videosProcessing = videoFiles.length - videosReady - videosErrored;

  const anyUploading = useMemo(() => files.some((f) => f.status === 'uploading'), [files]);

  const onPickFiles = useCallback(async (picked: FileList | null) => {
    if (!picked?.length) return;
    setBusy(true);
    setPhase('uploading');
    try {
      const selected = Array.from(picked);
      const { bulkUploadId: id, assetIds } = await uploadWithBulkId(
        selected,
        { bulkName: `Create Ad · ${new Date().toLocaleString()}` },
      );

      // Build a {file → assetId} mapping that survives concurrent uploads
      const videoAssetIds: string[] = [];
      const okAssetIds: string[] = [];
      for (let i = 0; i < selected.length; i++) {
        const aid = assetIds[i];
        if (typeof aid !== 'string' || !aid) continue;
        okAssetIds.push(aid);
        if (selected[i].type.startsWith('video/')) videoAssetIds.push(aid);
      }

      if (!id) throw new Error('Missing bulkUploadId');
      setBulkUploadId(id);

      // Wait for Cloudflare Stream encoding to finish for all video assets
      setPhase('processing');
      await waitForAssetsReady(videoAssetIds);

      // Run final content-mode group analysis
      setPhase('analyzing');
      await fetch(`/api/gallery/bulk-uploads/${encodeURIComponent(id)}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'content' }),
      });

      onUploaded({ bulkUploadId: id, assetIds: okAssetIds });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      setPhase('idle');
    }
  }, [uploadWithBulkId, onUploaded, onError]);

  const buttonLabel = phase === 'uploading'
    ? 'Uploading…'
    : phase === 'processing'
      ? `Processing videos… (${videosReady}/${videoFiles.length})`
      : phase === 'analyzing'
        ? 'Analyzing groups…'
        : busy || anyUploading ? 'Working…' : 'Select files';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/40 bg-background/20 p-5">
        <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Upload creatives
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a batch of images/videos. We’ll wait for Cloudflare to finish processing videos before grouping.
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
            {buttonLabel}
          </label>
          {bulkUploadId ? (
            <span className="glass-badge text-xs">Batch: {bulkUploadId}</span>
          ) : null}
        </div>
      </div>

      {/* ─── Active phase indicator ─────────────────────────────────── */}
      {phase === 'processing' || phase === 'analyzing' ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <svg className="h-4 w-4 flex-shrink-0 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <div className="min-w-0 flex-1">
              {phase === 'processing' ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    Waiting for Cloudflare Stream to finish encoding videos
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {videosReady} of {videoFiles.length} ready
                    {videosErrored > 0 ? ` · ${videosErrored} failed` : ''}
                    {videosProcessing > 0 ? ` · ${videosProcessing} processing` : ''}
                    {imageFiles.length > 0 ? ` · ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'} ready` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">Analyzing creative groups…</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Almost there.</p>
                </>
              )}
            </div>
            {phase === 'processing' && videoFiles.length > 0 ? (
              <div className="w-32 shrink-0">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.round((videosReady / Math.max(1, videoFiles.length)) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ─── Per-file progress list ─────────────────────────────────── */}
      {files.length > 0 ? (
        <div className="rounded-2xl border border-border/40 bg-background/20 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="font-ui text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Files
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
                        className={[
                          'h-full transition-all',
                          f.status === 'error' ? 'bg-destructive' : f.status === 'ready' ? 'bg-emerald-500' : 'bg-primary',
                        ].join(' ')}
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
