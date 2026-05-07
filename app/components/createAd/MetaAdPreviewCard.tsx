'use client';

import { useMemo } from 'react';

import type { Asset, CreativeFields } from './types';

function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function ctaLabel(ctaType: string) {
  switch (ctaType) {
    case 'SHOP_NOW': return 'Shop Now';
    case 'SIGN_UP': return 'Sign Up';
    case 'DOWNLOAD': return 'Download';
    case 'GET_QUOTE': return 'Get Quote';
    case 'CONTACT_US': return 'Contact Us';
    case 'BOOK_TRAVEL': return 'Book Now';
    case 'SUBSCRIBE': return 'Subscribe';
    case 'LEARN_MORE':
    default: return 'Learn More';
  }
}

export default function MetaAdPreviewCard({
  creative,
  asset,
  pageName = 'Your Page',
}: {
  creative: CreativeFields;
  asset: Asset;
  pageName?: string;
}) {
  const host = useMemo(() => hostFromUrl(creative.landingUrl), [creative.landingUrl]);

  return (
    <div className="rounded-2xl border border-border/40 bg-background/30 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-semibold">
          {pageName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{pageName}</p>
          <p className="text-[11px] text-muted-foreground">Sponsored</p>
        </div>
      </div>

      {creative.primaryText.trim() ? (
        <div className="px-4 pb-3">
          <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
            {creative.primaryText}
          </p>
        </div>
      ) : null}

      <div className="bg-muted/40">
        {asset.assetType === 'VIDEO' && asset.playbackUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            controls
            className="w-full max-h-[420px] object-contain bg-black"
            src={asset.playbackUrl}
          />
        ) : asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnailUrl}
            alt={asset.title}
            className="w-full max-h-[420px] object-contain bg-black"
          />
        ) : (
          <div className="h-[240px] flex items-center justify-center text-muted-foreground/60 text-sm">
            No preview
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/40 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{host}</p>
          <p className="text-sm font-semibold text-foreground truncate">{creative.headline || '—'}</p>
          {creative.description.trim() ? (
            <p className="text-[12px] text-muted-foreground truncate">{creative.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground hover:bg-[var(--glass-hover)] transition-colors"
        >
          {ctaLabel(creative.ctaType)}
        </button>
      </div>
    </div>
  );
}

