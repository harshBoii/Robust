'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';

import { GalleryLogoPicker } from '@/app/components/profile/GalleryLogoPicker';

type ProfileLogoFieldProps = {
  companyId: string;
  logoUrl: string;
  logoAssetId: string | null;
  onLogoUrlChange: (url: string) => void;
  onGallerySelect: (selection: { assetId: string; previewUrl: string }) => void;
  onClearGallery: () => void;
};

export function ProfileLogoField({
  companyId,
  logoUrl,
  logoAssetId,
  onLogoUrlChange,
  onGallerySelect,
  onClearGallery,
}: ProfileLogoFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const preview = logoUrl.trim() || null;

  return (
    <div className="space-y-2">
      <span className="font-ui text-[11px] font-medium text-muted-foreground">Logo</span>

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--glass-border)] bg-muted/20">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="glass-input w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            placeholder="https://…"
            value={logoUrl}
            onChange={(e) => onLogoUrlChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium"
            >
              Choose from gallery
            </button>
            {logoAssetId || logoUrl ? (
              <button
                type="button"
                onClick={() => {
                  onClearGallery();
                  onLogoUrlChange('');
                }}
                className="glass-button rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                Remove logo
              </button>
            ) : null}
          </div>
          {logoAssetId ? (
            <p className="text-[10px] text-muted-foreground">Using a gallery image</p>
          ) : null}
        </div>
      </div>

      {pickerOpen ? (
        <GalleryLogoPicker
          companyId={companyId}
          onClose={() => setPickerOpen(false)}
          onSelect={onGallerySelect}
        />
      ) : null}
    </div>
  );
}
