'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';
import { Check, ImageIcon, Upload, X } from 'lucide-react';

import { useUploader } from '@/app/hooks/useUploader';
import { useToast } from '@/app/components/UI/ToastProvider';
import {
  fetchAssetDisplayUrl,
  fetchLogoAssets,
  type LogoAssetOption,
} from '@/lib/profile/client';

type GalleryLogoPickerProps = {
  companyId: string;
  onClose: () => void;
  onSelect: (selection: { assetId: string; previewUrl: string }) => void;
};

function assetPreviewSrc(asset: LogoAssetOption): string | null {
  return asset.thumbnailUrl;
}

export function GalleryLogoPicker({ companyId, onClose, onSelect }: GalleryLogoPickerProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const appliedUploadRef = useRef<string | null>(null);
  const { upload, files } = useUploader(companyId);
  const [assets, setAssets] = useState<LogoAssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const uploading = files.some((f) => f.status === 'uploading' || f.status === 'processing');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await fetchLogoAssets());
    } catch (e) {
      toast.push({
        title: 'Could not load gallery',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    const ready = files.find((f) => f.status === 'ready' && f.assetId);
    if (!ready?.assetId || appliedUploadRef.current === ready.assetId) return;
    appliedUploadRef.current = ready.assetId;
    setSelectedId(ready.assetId);
    void loadAssets();
  }, [files, loadAssets]);

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.push({ title: 'Choose an image file', kind: 'error' });
      return;
    }
    try {
      await upload([file], { bulkName: `Profile logo ${new Date().toLocaleDateString()}` });
    } catch (e) {
      toast.push({
        title: 'Upload failed',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    }
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    setConfirming(true);
    try {
      const previewUrl = await fetchAssetDisplayUrl(selectedId);
      onSelect({ assetId: selectedId, previewUrl });
      onClose();
    } catch (e) {
      toast.push({
        title: 'Could not use this image',
        message: e instanceof Error ? e.message : undefined,
        kind: 'error',
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-4 py-3">
          <h3 className="font-display text-sm font-semibold">Choose from gallery</h3>
          <button type="button" onClick={onClose} className="glass-button rounded-lg p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[var(--glass-border)] px-4 py-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="glass-button flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? (
              <>
                <AiOutlineLoading className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload new image
              </>
            )}
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <AiOutlineLoading className="h-5 w-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-50" />
              <p>No images in your gallery yet.</p>
              <p className="text-xs">Upload one above to use it as your logo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {assets.map((asset) => {
                const src = assetPreviewSrc(asset);
                const isSelected = selectedId === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(asset.id)}
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[var(--clipfox-primary)] ring-2 ring-[var(--clipfox-primary)]/30'
                        : 'border-transparent hover:border-[var(--glass-border)]'
                    }`}
                    title={asset.title || asset.filename}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted/30">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {isSelected ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--clipfox-primary)] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--glass-border)] px-4 py-3">
          <button
            type="button"
            disabled={!selectedId || confirming}
            onClick={() => void handleConfirm()}
            className="glass-button-primary w-full rounded-xl py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {confirming ? 'Applying…' : 'Use selected image'}
          </button>
        </div>
      </div>
    </div>
  );
}
