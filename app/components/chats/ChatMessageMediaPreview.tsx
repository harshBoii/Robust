'use client';

import { useEffect, useState } from 'react';

import { DownloadImageButton } from './widgets/ImageGenWidgets';
import {
  GeoBountyPreviewWidget,
  parseGeoBountyPreviewPayload,
} from './widgets/GeoBountyPreviewWidget';
import {
  GeoRedditTargetPickerWidget,
  parseGeoRedditTargetPickerPayload,
} from './widgets/GeoRedditTargetPickerWidget';

function SingleResultImagePreview({
  imageUrl,
  assetId,
}: {
  imageUrl?: string;
  assetId?: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(imageUrl);

  useEffect(() => {
    setResolvedUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (resolvedUrl || !assetId) return;
    let cancelled = false;
    void fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string } | null) => {
        if (!cancelled && typeof data?.url === 'string') setResolvedUrl(data.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetId, resolvedUrl]);

  if (!resolvedUrl) return null;

  return (
    <div className="mb-2 space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedUrl}
        alt="Generated ad"
        className="max-h-80 w-full rounded-lg border border-border/40 object-contain bg-muted/30"
      />
      <DownloadImageButton imageUrl={resolvedUrl} filename="robust-ad.png" />
    </div>
  );
}

/** Read-only image previews from chat widget payloads (stay visible after step advances). */

export function ChatMessageMediaPreview({
  widgetType,
  widgetPayload,
}: {
  widgetType: string | null | undefined;
  widgetPayload: unknown;
}) {
  if (!widgetType) return null;

  const payload = (widgetPayload ?? {}) as Record<string, unknown>;

  if (widgetType === 'imageGenSingleResult') {
    const imageUrl = payload.imageUrl as string | undefined;
    const assetId = payload.assetId as string | undefined;
    if (!imageUrl && !assetId) return null;
    return <SingleResultImagePreview imageUrl={imageUrl} assetId={assetId} />;
  }

  if (widgetType === 'imageGenTemplateGrid') {
    const outputs =
      (payload.outputs as Array<{ label?: string; imageUrl?: string; status?: string }>) ?? [];
    const withImages = outputs.filter((o) => o.imageUrl);
    if (!withImages.length) return null;

    return (
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {withImages.map((o, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
            {o.label ? (
              <p className="truncate px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {o.label}
              </p>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.imageUrl} alt={o.label ?? `Output ${i + 1}`} className="aspect-square w-full object-cover" />
            <div className="px-2 pb-2">
              <DownloadImageButton imageUrl={o.imageUrl!} filename={`robust-template-${i + 1}.png`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (widgetType === 'imageGenVariantGrid') {
    const variants =
      (payload.variants as Array<{
        ideaLabel?: string;
        imageUrl?: string;
        status?: string;
      }>) ?? [];
    const withImages = variants.filter((v) => v.imageUrl);
    if (!withImages.length) return null;

    return (
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {withImages.map((v, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border/40 bg-muted/20">
            {v.ideaLabel ? (
              <p className="truncate px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {v.ideaLabel}
              </p>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.imageUrl} alt={v.ideaLabel ?? `Variant ${i + 1}`} className="aspect-square w-full object-cover" />
            <div className="px-2 pb-2">
              <DownloadImageButton
                imageUrl={v.imageUrl!}
                filename={`robust-variant-${i + 1}.png`}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (widgetType === 'geoBountyPreviews') {
    const preview = parseGeoBountyPreviewPayload(widgetPayload);
    if (!preview) return null;
    return <GeoBountyPreviewWidget payload={preview} />;
  }

  if (widgetType === 'geoRedditTargetPicker') {
    const picker = parseGeoRedditTargetPickerPayload(widgetPayload);
    if (!picker) return null;
    return (
      <GeoRedditTargetPickerWidget
        payload={picker}
        onAction={async () => {}}
        disabled
      />
    );
  }

  return null;
}

export function messageHasMediaPreview(
  widgetType: string | null | undefined,
  widgetPayload: unknown,
): boolean {
  if (!widgetType) return false;
  const payload = (widgetPayload ?? {}) as Record<string, unknown>;
  if (widgetType === 'imageGenSingleResult') {
    return Boolean(payload.imageUrl || payload.assetId);
  }
  if (widgetType === 'imageGenVariantGrid') {
    const variants = payload.variants as Array<{ imageUrl?: string }> | undefined;
    return Boolean(variants?.some((v) => v.imageUrl));
  }
  if (widgetType === 'imageGenTemplateGrid') {
    const outputs = payload.outputs as Array<{ imageUrl?: string }> | undefined;
    return Boolean(outputs?.some((o) => o.imageUrl));
  }
  if (widgetType === 'geoBountyPreviews') {
    return Boolean(parseGeoBountyPreviewPayload(widgetPayload));
  }
  if (widgetType === 'geoRedditTargetPicker') {
    return Boolean(parseGeoRedditTargetPickerPayload(widgetPayload));
  }
  return false;
}
