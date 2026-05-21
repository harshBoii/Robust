'use client';

import { DownloadImageButton } from './widgets/ImageGenWidgets';

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
    if (!imageUrl) return null;
    return (
      <div className="mb-2 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Generated ad"
          className="max-h-80 w-full rounded-lg border border-border/40 object-contain bg-muted/30"
        />
        <DownloadImageButton imageUrl={imageUrl} filename="robust-ad.png" />
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

  return null;
}

export function messageHasMediaPreview(
  widgetType: string | null | undefined,
  widgetPayload: unknown,
): boolean {
  if (!widgetType) return false;
  const payload = (widgetPayload ?? {}) as Record<string, unknown>;
  if (widgetType === 'imageGenSingleResult') return Boolean(payload.imageUrl);
  if (widgetType === 'imageGenVariantGrid') {
    const variants = payload.variants as Array<{ imageUrl?: string }> | undefined;
    return Boolean(variants?.some((v) => v.imageUrl));
  }
  return false;
}
