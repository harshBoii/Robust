// app/gallery/_components/GalleryUploadZone.tsx
'use client';

import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, FolderOpen, HardDrive, X, Film, ImageIcon, FileWarning } from 'lucide-react';

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
export type UploadedFile = {
  file: File;
  previewUrl: string | null;
  type: 'video' | 'image';
};

type Props = {
  onUploadStart: (bulkUploadId: string) => void;
};

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAutoName(): string {
  return `Upload · ${new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })}`;
}

function classifyFile(file: File): 'video' | 'image' | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

const ACCEPTED_TYPES = ['video/*', 'image/*'];
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

/* ─────────────────────────────────────────
   STAGED FILE CARD
───────────────────────────────────────── */
const StagedFileCard = ({
  item,
  onRemove,
}: {
  item: UploadedFile;
  onRemove: () => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.15 }}
    className="glass relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
  >
    {/* Thumbnail / icon */}
    <div className="h-10 w-10 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-[var(--glass-hover)]">
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
      ) : item.type === 'video' ? (
        /* reddish accent for video icon */
        <Film className="w-4 h-4 text-[color:var(--sibling-red,var(--destructive))]" />
      ) : (
        <ImageIcon className="w-4 h-4 text-[color:var(--sibling-red,var(--destructive))]" />
      )}
    </div>

    {/* File info */}
    <div className="flex-1 min-w-0">
      <p className="font-body text-[12px] font-medium truncate text-foreground">
        {item.file.name}
      </p>
      <p className="font-ui text-[11px] text-muted-foreground/60">
        {formatBytes(item.file.size)} · {item.type}
      </p>
    </div>

    {/* Remove */}
    <button
      type="button"
      onClick={onRemove}
      className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-colors text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </motion.div>
);

/* ─────────────────────────────────────────
   BULK NAME MODAL
───────────────────────────────────────── */
const BulkNameModal = ({
  fileCount,
  onConfirm,
  onCancel,
  isUploading,
}: {
  fileCount: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isUploading: boolean;
}) => {
  const [name, setName] = useState(getAutoName());

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'oklch(0 0 0 / 0.45)' }}
        onClick={onCancel}
      />

      {/* Modal card */}
      <motion.div
        className="glass-modal relative z-10 w-full max-w-sm p-6"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      >
        {/* Header — reddish accent dot */}
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--sibling-red,var(--destructive))_12%,transparent)]">
            <Upload className="h-3.5 w-3.5 text-[color:var(--sibling-red,var(--destructive))]" />
          </div>
          <div>
            <h3 className="font-display text-[1rem] font-semibold mb-1 text-foreground">
              Name this upload
            </h3>
            <p className="font-body text-[13px] text-muted-foreground/70">
              {fileCount} files selected. Give this batch a name so you can find it later.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="mb-5">
          <label
            htmlFor="bulk-upload-name"
            className="font-ui block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5 text-muted-foreground/50"
          >
            Batch Name
          </label>
          <input
            id="bulk-upload-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="glass-input w-full rounded-xl px-3.5 py-2.5 font-body text-[13px] text-foreground placeholder:text-muted-foreground"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onConfirm(name.trim());
              if (e.key === 'Escape') onCancel();
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="glass-button flex-1 rounded-xl py-2.5 font-ui text-[13px] font-medium text-muted-foreground/70 border border-[var(--glass-border)] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim() || isUploading}
            className="
              flex-1 rounded-xl py-2.5 font-ui text-[13px] font-semibold
              flex items-center justify-center gap-2 transition-all
              disabled:opacity-60 disabled:cursor-not-allowed
              text-white
            "
            style={{
              background: 'linear-gradient(135deg, var(--sibling-red, var(--destructive)), color-mix(in srgb, var(--sibling-red, var(--destructive)) 75%, #000))',
              boxShadow: '0 2px 12px color-mix(in srgb, var(--sibling-red, var(--destructive)) 35%, transparent)',
            }}
          >
            {isUploading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>Start Upload</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export default function GalleryUploadZone({ onUploadStart }: Props) {
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging]       = useState(false);
  const [stagedFiles, setStagedFiles]     = useState<UploadedFile[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [isUploading, setIsUploading]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  /* ── File ingestion ── */
  const ingestFiles = useCallback((incoming: FileList | File[]) => {
    setError(null);
    const arr = Array.from(incoming);
    const valid: UploadedFile[] = [];
    const rejected: string[]    = [];

    for (const file of arr) {
      const kind = classifyFile(file);
      if (!kind)                           { rejected.push(`${file.name} (unsupported type)`); continue; }
      if (file.size > MAX_FILE_SIZE_BYTES) { rejected.push(`${file.name} (>500 MB)`);          continue; }
      const previewUrl = kind === 'image' ? URL.createObjectURL(file) : null;
      valid.push({ file, previewUrl, type: kind });
    }

    if (rejected.length) setError(`Skipped: ${rejected.join(', ')}`);

    setStagedFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.file.name}__${f.file.size}`));
      return [...prev, ...valid.filter((f) => !existing.has(`${f.file.name}__${f.file.size}`))];
    });
  }, []);

  /* ── Drag handlers ── */
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
  };

  /* ── File input ── */
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      ingestFiles(e.target.files);
      e.target.value = '';
    }
  };

  /* ── Remove staged file ── */
  const removeFile = (idx: number) => {
    setStagedFiles((prev) => {
      const item = prev[idx];
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── Proceed ── */
  const handleProceed = () => {
    if (!stagedFiles.length) return;
    if (stagedFiles.length > 1) {
      setShowNameModal(true);
    } else {
      void doUpload(getAutoName());
    }
  };

  /* ── Google Drive placeholder ── */
  const handleGoogleDrive = () => {
    alert('Google Drive integration coming soon. Drop files for now.');
  };

  /* ── Upload ── */
  const doUpload = async (bulkUploadName: string) => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('bulkUploadName', bulkUploadName);
      stagedFiles.forEach(({ file }) => formData.append('files', file));

      const res = await fetch('/api/gallery/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Upload failed (${res.status})`);
      }

      const data = (await res.json()) as { bulkUploadId: string };
      stagedFiles.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
      onUploadStart(data.bulkUploadId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setIsUploading(false);
      setShowNameModal(false);
    }
  };

  /* ── Derived state ── */
  const hasFiles   = stagedFiles.length > 0;
  const videoCount = stagedFiles.filter((f) => f.type === 'video').length;
  const imageCount = stagedFiles.filter((f) => f.type === 'image').length;

  return (
    <>
      {/*
        ┌─ Centering wrapper ──────────────────────────────────────┐
        │  Fills the available page area and centers the panel     │
        │  both horizontally and vertically.                       │
        └──────────────────────────────────────────────────────────┘
      */}
      <div className="flex h-full w-full items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-lg flex-col gap-4">

          {/* ══════════════════════════════
              PAGE HEADER
          ══════════════════════════════ */}
          <div className="mb-2 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--sibling-red, var(--destructive)) 12%, transparent)',
              }}
            >
              <Upload className="h-4 w-4 text-[color:var(--sibling-red,var(--destructive))]" />
            </div>
            <div>
              <h2 className="font-display text-[15px] font-semibold text-foreground">Upload Creatives</h2>
              <p className="font-ui text-[11px] text-muted-foreground/55">
                Videos & images · Max 500 MB each
              </p>
            </div>
          </div>

          {/* ══════════════════════════════
              DROP ZONE
          ══════════════════════════════ */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !hasFiles && fileInputRef.current?.click()}
            className="relative rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer select-none"
            style={{
              minHeight: hasFiles ? 140 : 260,
              borderColor: isDragging
                ? 'var(--sibling-red, var(--destructive))'
                : 'var(--glass-border)',
              background: isDragging
                ? 'color-mix(in srgb, var(--sibling-red, var(--destructive)) 5%, var(--background))'
                : 'color-mix(in srgb, var(--glass-bg, var(--glass)) 30%, transparent)',
            }}
          >
            {/* Animated upload icon — reddish */}
            <motion.div
              animate={isDragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl transition-colors"
              style={{
                background: isDragging
                  ? 'color-mix(in srgb, var(--sibling-red, var(--destructive)) 15%, transparent)'
                  : 'var(--glass-hover)',
              }}
            >
              <Upload
                className="w-6 h-6 transition-colors"
                style={{
                  color: isDragging
                    ? 'var(--sibling-red, var(--destructive))'
                    : 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)',
                }}
              />
            </motion.div>

            {/* Copy */}
            <div className="text-center px-6">
              <p className="font-body text-[14px] font-semibold mb-1 text-foreground">
                {isDragging ? 'Drop to add files' : 'Drag & drop your creatives here'}
              </p>
              <p className="font-ui text-[12px] text-muted-foreground/55">
                MP4, MOV, WebM, JPG, PNG, WebP · Max 500 MB per file
              </p>
            </div>

            {/* Action buttons */}
            {!isDragging && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="glass-button flex items-center gap-2 rounded-xl px-4 py-2.5 font-ui text-[13px] font-medium text-foreground border border-[var(--glass-border)] transition-all"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Select Files
                </button>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleGoogleDrive(); }}
                  className="glass-button flex items-center gap-2 rounded-xl px-4 py-2.5 font-ui text-[13px] font-medium text-foreground border border-[var(--glass-border)] transition-all"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  Google Drive
                </button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="sr-only"
            onChange={onFileInputChange}
          />

          {/* ══════════════════════════════
              ERROR BANNER
          ══════════════════════════════ */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 border border-destructive/25 bg-destructive/10"
              >
                <FileWarning className="w-4 h-4 flex-shrink-0 mt-px text-destructive" />
                <p className="font-body text-[12px] text-destructive flex-1">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-destructive/70 hover:text-destructive transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════════════════════
              STAGED FILES LIST
          ══════════════════════════════ */}
          <AnimatePresence>
            {hasFiles && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2"
              >
                {/* List header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[12px] font-semibold text-foreground">
                      {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''} staged
                    </span>

                    <div className="flex items-center gap-1.5">
                      {videoCount > 0 && (
                        <span
                          className="glass-badge inline-flex items-center gap-1 font-ui text-[10px]"
                          style={{ color: 'var(--sibling-red, var(--destructive))' }}
                        >
                          <Film className="w-2.5 h-2.5" />
                          {videoCount} video{videoCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {imageCount > 0 && (
                        <span
                          className="glass-badge inline-flex items-center gap-1 font-ui text-[10px]"
                          style={{
                            color: 'color-mix(in srgb, var(--sibling-red, var(--destructive)) 70%, var(--foreground))',
                          }}
                        >
                          <ImageIcon className="w-2.5 h-2.5" />
                          {imageCount} image{imageCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      stagedFiles.forEach(({ previewUrl }) => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
                      setStagedFiles([]);
                    }}
                    className="font-ui text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                </div>

                {/* File cards */}
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto glass-scrollbar pr-1">
                  <AnimatePresence mode="popLayout">
                    {stagedFiles.map((item, idx) => (
                      <StagedFileCard
                        key={`${item.file.name}__${item.file.size}`}
                        item={item}
                        onRemove={() => removeFile(idx)}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Upload CTA — reddish */}
                <motion.button
                  type="button"
                  onClick={handleProceed}
                  layoutId="upload-cta"
                  className="w-full rounded-xl py-3 font-ui text-[13px] font-semibold flex items-center justify-center gap-2 mt-1 text-white transition-all"
                  style={{
                    background: 'linear-gradient(135deg, var(--sibling-red, var(--destructive)), color-mix(in srgb, var(--sibling-red, var(--destructive)) 70%, #1a0000))',
                    boxShadow: '0 4px 16px color-mix(in srgb, var(--sibling-red, var(--destructive)) 30%, transparent)',
                  }}
                  whileHover={{ filter: 'brightness(1.1)' }}
                  whileTap={{ scale: 0.985 }}
                >
                  <Upload className="w-4 h-4" />
                  Upload {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* ══════════════════════════════
          BULK NAME MODAL
      ══════════════════════════════ */}
      <AnimatePresence>
        {showNameModal && (
          <BulkNameModal
            fileCount={stagedFiles.length}
            onConfirm={(name) => void doUpload(name)}
            onCancel={() => setShowNameModal(false)}
            isUploading={isUploading}
          />
        )}
      </AnimatePresence>
    </>
  );
}