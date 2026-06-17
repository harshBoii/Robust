'use client';

import { useCallback, useEffect, useState } from 'react';

import { useUploader } from '@/app/hooks/useUploader';
import type { WorkflowState } from '@/lib/chats/types';

import { IMAGE_ARTISTS, type ImageArtistId, type ImageQuality } from '@/lib/image-gen/image-artists';

import {
  defaultArtistSettings,
  ImageGenArtistSettingsBar,
} from '../ImageGenArtistSettingsBar';

import type { ChatWidgetDispatch } from './ChatWidgets';

export function DownloadImageButton({
  imageUrl,
  filename = 'robust-ad.png',
}: {
  imageUrl: string;
  filename?: string;
}) {
  const onDownload = useCallback(async () => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    }
  }, [imageUrl, filename]);

  return (
    <button
      type="button"
      onClick={() => void onDownload()}
      className="rounded-full border border-border/50 bg-background/90 px-3 py-1 text-[12px] font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
    >
      Download
    </button>
  );
}

function ImageWithDownload({
  imageUrl,
  alt,
  filename,
  className,
}: {
  imageUrl: string;
  alt: string;
  filename?: string;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={alt} className={className ?? 'max-h-80 w-full rounded-lg border object-contain'} />
      <DownloadImageButton imageUrl={imageUrl} filename={filename} />
    </div>
  );
}

type ShopifyProduct = {
  id: string;
  title: string;
  description: string | null;
  featuredImageUrl: string | null;
  priceMinAmount: string | null;
  currencyCode: string | null;
};

type ExistingAd = {
  id: string;
  name: string;
  thumbnailUrl: string;
  assetId: string | null;
};

type CatalogItem = { id: string; label: string; imageUrl: string; category?: string };

export function ImageGenSourceChoiceWidget({
  onAction,
  mode,
}: {
  onAction: ChatWidgetDispatch;
  mode?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void onAction('imageGen.source', { source: 'shopify' }, 'Shopify product')}
        className="rounded-full border border-border/50 bg-background/70 px-3.5 py-1.5 text-[13px] font-medium transition hover:border-primary/40"
      >
        Shopify
      </button>
      <button
        type="button"
        onClick={() => void onAction('imageGen.source', { source: 'custom' }, 'Upload image')}
        className="rounded-full border border-border/50 bg-background/70 px-3.5 py-1.5 text-[13px] font-medium transition hover:border-primary/40"
      >
        {mode === 'productOnModel' ? 'Upload product' : 'Custom upload'}
      </button>
    </div>
  );
}

export function ShopifyProductPickerWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/shop/products', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { products?: ShopifyProduct[] }) => setProducts(d.products ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[13px] text-muted-foreground">Loading products…</p>;
  if (!products.length) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
        <p className="text-[13px] text-foreground">
          No Shopify products synced. Upload a custom image below, or type in chat if you want to go back
          to product source.
        </p>
        <button
          type="button"
          onClick={() => void onAction('imageGen.source', { source: 'custom' }, 'Upload image')}
          className="rounded-full border border-border/50 bg-background/80 px-3.5 py-1.5 text-[13px] font-medium"
        >
          Upload image
        </button>
      </div>
    );
  }

  return (
    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() =>
            void onAction('imageGen.shopifySelected', { productId: p.id, title: p.title })
          }
          className="flex flex-col overflow-hidden rounded-lg border border-border/50 text-left transition hover:border-primary/40"
        >
          {p.featuredImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.featuredImageUrl} alt="" className="aspect-square w-full object-cover" />
          ) : (
            <div className="aspect-square bg-muted" />
          )}
          <span className="truncate px-2 py-1 text-[12px] font-medium">{p.title}</span>
        </button>
      ))}
    </div>
  );
}

export function ImageGenUploadWidget({
  companyId,
  onAction,
}: {
  companyId: string;
  onAction: ChatWidgetDispatch;
}) {
  const { uploadWithBulkId } = useUploader(companyId);
  const [busy, setBusy] = useState(false);

  const onPick = useCallback(
    async (picked: FileList | null) => {
      if (!picked?.length || busy) return;
      setBusy(true);
      try {
        const files = Array.from(picked).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        const { assetIds } = await uploadWithBulkId(files, {
          bulkName: `Image gen · ${new Date().toLocaleString()}`,
        });
        const assetId = assetIds[0];
        if (!assetId) return;
        const file = files[0];
        let imageUrl: string | undefined;
        try {
          const urlRes = await fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, {
            credentials: 'include',
          });
          if (urlRes.ok) {
            const urlData = (await urlRes.json()) as { url?: string };
            imageUrl = typeof urlData.url === 'string' ? urlData.url : undefined;
          }
        } catch {
          imageUrl = undefined;
        }
        await onAction(
          'imageGen.uploaded',
          {
            assetId,
            imageUrl,
            fileName: file.name,
            mimeType: file.type,
          },
          file.name,
        );
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [uploadWithBulkId, onAction, busy],
  );

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-[13px] font-medium">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={busy}
        onChange={(e) => void onPick(e.target.files)}
      />
      {busy ? 'Uploading…' : 'Choose images'}
    </label>
  );
}

export function ImageGenArtistSettingsWidget({
  payload,
  onAction,
  hideControls,
  pickerMode,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
  /** When composer footer shows the same dropdowns */
  hideControls?: boolean;
  /** Full composer replaced by compact picker footer */
  pickerMode?: boolean;
}) {
  const defaults = defaultArtistSettings();
  const [artistId, setArtistId] = useState<ImageArtistId>(
    (payload.selectedArtistId as ImageArtistId) ?? defaults.artistId,
  );
  const [quality, setQuality] = useState<ImageQuality>(
    (payload.selectedQuality as ImageQuality) ?? defaults.quality,
  );

  const submit = () => {
    const artist = IMAGE_ARTISTS.find((a) => a.id === artistId);
    void onAction(
      'imageGen.artistSettings',
      { artistId, quality },
      `${artist?.name ?? 'Artist'} · ${quality} quality`,
    );
  };

  if (hideControls) {
    return (
      <p className="text-[13px] text-muted-foreground">
        {pickerMode ? (
          <>
            Choose your image artist and quality in the picker below, then tap{' '}
            <strong className="font-medium text-foreground">Continue</strong>.
          </>
        ) : (
          <>
            Choose your image artist and quality in the menus below the message box, then tap{' '}
            <strong className="font-medium text-foreground">Continue</strong>.
          </>
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Pick who generates your images and at what quality.
      </p>
      <ImageGenArtistSettingsBar
        artistId={artistId}
        quality={quality}
        onArtistChange={setArtistId}
        onQualityChange={setQuality}
        onContinue={submit}
      />
    </div>
  );
}

export function ImageGenGeneratingWidget() {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      Generating image…
    </div>
  );
}

export function ImageGenSingleResultWidget({
  payload,
}: {
  payload: Record<string, unknown>;
  onAction?: ChatWidgetDispatch;
}) {
  const imageUrl = payload.imageUrl as string | undefined;
  const assetId = payload.assetId as string | undefined;
  const artistName = payload.artistName as string | undefined;
  const imageQuality = payload.imageQuality as string | undefined;
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

  return (
    <div>
      {artistName || imageQuality ? (
        <p className="mb-2 text-[11px] text-muted-foreground">
          {artistName}
          {imageQuality ? ` · ${imageQuality} quality` : ''}
        </p>
      ) : null}
      {resolvedUrl ? (
        <ImageWithDownload
          imageUrl={resolvedUrl}
          alt="Generated ad"
          filename={`robust-${(artistName ?? 'ad').toLowerCase().replace(/\s+/g, '-')}.png`}
        />
      ) : (
        <p className="text-[13px] text-muted-foreground">Image preview unavailable.</p>
      )}
    </div>
  );
}

type NextStepOption = { id: string; label: string; description: string };

export function ImageGenNextStepWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const options = (payload.options as NextStepOption[]) ?? [];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() =>
              void onAction(
                'imageGen.nextStepChosen',
                { choiceId: opt.id, label: opt.label },
                opt.label,
              )
            }
            className="rounded-xl border border-border/50 bg-background/80 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="block text-[13px] font-semibold text-foreground">{opt.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              {opt.description}
            </span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Or type what you want next — we&apos;ll route you automatically.
      </p>
    </div>
  );
}

export function ImageGenVariantSourceWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { source: 'existing', label: 'Existing ads' },
        { source: 'attachment', label: 'Upload image' },
      ].map((o) => (
        <button
          key={o.source}
          type="button"
          onClick={() => void onAction('imageGen.variantSource', { source: o.source }, o.label)}
          className="rounded-full border border-border/50 px-3.5 py-1.5 text-[13px] font-medium"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ImageGenExistingAdPickerWidget({ onAction }: { onAction: ChatWidgetDispatch }) {
  const [ads, setAds] = useState<ExistingAd[]>([]);

  useEffect(() => {
    void fetch('/api/image-gen/existing-ads', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { ads?: ExistingAd[] }) => setAds(d.ads ?? []));
  }, []);

  if (!ads.length) {
    return <p className="text-[13px] text-muted-foreground">No ads with images found yet.</p>;
  }

  return (
    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
      {ads.map((ad) => (
        <button
          key={ad.id}
          type="button"
          onClick={() =>
            void onAction('imageGen.existingAdSelected', { creativeId: ad.id }, ad.name)
          }
          className="overflow-hidden rounded-lg border text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
          <span className="block truncate px-2 py-1 text-[12px]">{ad.name}</span>
        </button>
      ))}
    </div>
  );
}

export function ImageGenIdeaReviewWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const fromVariants =
    (payload.variants as Array<{ ideaLabel: string; prompt: string }>) ?? [];
  const legacyIdeas = (payload.ideas as string[]) ?? [];
  const rows =
    fromVariants.length > 0
      ? fromVariants.map((v, i) => ({
          index: i,
          ideaLabel: v.ideaLabel,
          prompt: v.prompt,
        }))
      : legacyIdeas.map((label, i) => ({
          index: i,
          ideaLabel: label,
          prompt: '',
        }));

  const [edits, setEdits] = useState<Record<number, string>>({});

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.index}
            className="rounded-lg border border-border/40 bg-background/80 p-3"
          >
            <p className="text-[13px] font-semibold text-foreground">
              <span className="text-muted-foreground">Prompt {row.index + 1} · </span>
              {row.ideaLabel}
            </p>
            {row.prompt ? (
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                {row.prompt}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <details className="text-[12px] text-muted-foreground">
        <summary className="cursor-pointer">Change a prompt (widget)</summary>
        <p className="mt-1 text-[11px]">
          Or type in chat, e.g. &quot;change prompt 1 to a warmer studio look&quot;.
        </p>
        <div className="mt-2 space-y-2">
          {rows.map((row) => (
            <div key={row.index} className="flex gap-2">
              <span className="w-16 shrink-0 pt-2 text-[11px] font-medium">
                Prompt {row.index + 1}
              </span>
              <input
                className="flex-1 rounded border border-border/50 bg-background px-2 py-1 text-[12px]"
                placeholder={`New direction for "${row.ideaLabel}"`}
                value={edits[row.index] ?? ''}
                onChange={(e) => setEdits((prev) => ({ ...prev, [row.index]: e.target.value }))}
              />
            </div>
          ))}
          <button
            type="button"
            className="rounded-full border px-3 py-1 text-[12px]"
            onClick={() => {
              const changes = Object.entries(edits)
                .filter(([, d]) => d.trim())
                .map(([idx, description]) => ({
                  index: Number(idx),
                  description: description.trim(),
                }));
              if (changes.length) {
                void onAction('imageGen.ideasChanged', { changes }, 'Update ideas');
              }
            }}
          >
            Apply prompt changes
          </button>
        </div>
      </details>
      <button
        type="button"
        onClick={() => void onAction('imageGen.ideasAccepted', {}, 'Accept all ideas')}
        className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
      >
        Accept all & generate
      </button>
    </div>
  );
}

export function ImageGenTemplateGridWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const outputs =
    (payload.outputs as Array<{
      label: string;
      status?: string;
      imageUrl?: string;
      error?: string;
    }>) ?? [];
  const artistName = payload.artistName as string | undefined;
  const imageQuality = payload.imageQuality as string | undefined;

  return (
    <div className="space-y-2">
      {artistName || imageQuality ? (
        <p className="text-[11px] text-muted-foreground">
          {artistName}
          {imageQuality ? ` · ${imageQuality} quality` : ''}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {outputs.map((o, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-2">
            <p className="mb-1 truncate text-[12px] font-medium">{o.label}</p>
            {o.imageUrl ? (
              <div className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
                <DownloadImageButton
                  imageUrl={o.imageUrl}
                  filename={`robust-${o.label.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}.png`}
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
                {o.status === 'failed' ? o.error ?? 'Failed' : 'Pending'}
              </div>
            )}
            {o.status === 'failed' && (
              <button
                type="button"
                className="mt-2 text-[11px] text-primary underline"
                onClick={() =>
                  void onAction('imageGen.templateRegenerate', { index: i }, `Regenerate ${o.label}`)
                }
              >
                Regenerate
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImageGenVariantGridWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const loading = Boolean(payload.loading);
  const variants =
    (payload.variants as Array<{
      ideaLabel: string;
      status?: string;
      imageUrl?: string;
      error?: string;
    }>) ?? [];

  if (loading) {
    return <ImageGenGeneratingWidget />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {variants.map((v, i) => (
        <div key={i} className="rounded-lg border border-border/50 p-2">
          <p className="mb-1 truncate text-[12px] font-medium">{v.ideaLabel}</p>
          {v.imageUrl ? (
            <div className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
              <DownloadImageButton
                imageUrl={v.imageUrl}
                filename={`robust-${v.ideaLabel.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}.png`}
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded bg-muted px-2 text-center text-[11px] text-muted-foreground">
              {v.status === 'failed' ? 'Generation failed' : 'Pending'}
            </div>
          )}
          {v.status === 'failed' && (
            <button
              type="button"
              className="mt-2 text-[11px] text-primary underline"
              onClick={() =>
                void onAction('imageGen.variantRegenerate', { index: i }, `Regenerate ${v.ideaLabel}`)
              }
            >
              Regenerate
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function CatalogGallery({
  items,
  onSelect,
  action,
  payloadKey,
}: {
  items: CatalogItem[];
  onSelect: ChatWidgetDispatch;
  action: string;
  payloadKey: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() =>
            void onSelect(action, { [payloadKey]: item.id, label: item.label }, item.label)
          }
          className="overflow-hidden rounded-lg border text-left transition hover:border-primary/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.label} className="aspect-[4/5] w-full object-cover" />
          <span className="block px-2 py-1 text-[11px]">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function CatalogGalleryWithUpload({
  items,
  onSelect,
  action,
  payloadKey,
  uploadRole,
  companyId,
  uploadLabel,
}: {
  items: CatalogItem[];
  onSelect: ChatWidgetDispatch;
  action: string;
  payloadKey: string;
  uploadRole: 'model' | 'background' | 'pose';
  companyId: string;
  uploadLabel: string;
}) {
  const { uploadWithBulkId } = useUploader(companyId);
  const [busy, setBusy] = useState(false);

  const onPick = useCallback(
    async (picked: FileList | null) => {
      if (!picked?.length || busy) return;
      setBusy(true);
      try {
        const files = Array.from(picked).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        const { assetIds } = await uploadWithBulkId(files, {
          bulkName: `On-model ${uploadRole} · ${new Date().toLocaleString()}`,
        });
        const assetId = assetIds[0];
        if (!assetId) return;
        await onSelect(
          'imageGen.uploaded',
          { assetId, role: uploadRole },
          uploadLabel,
        );
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [busy, onSelect, uploadRole, uploadLabel, uploadWithBulkId],
  );

  return (
    <div className="space-y-3">
      <CatalogGallery items={items} onSelect={onSelect} action={action} payloadKey={payloadKey} />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-[12px] font-medium transition hover:border-primary/40">
        <input
          type="file"
          className="sr-only"
          accept="image/*"
          disabled={busy}
          onChange={(e) => void onPick(e.target.files)}
        />
        {busy ? 'Uploading…' : uploadLabel}
      </label>
      <p className="text-[11px] text-muted-foreground">
        Or type a name in chat (e.g. {items[0]?.label ? `"${items[0].label}"` : 'a catalog option'}).
      </p>
    </div>
  );
}

export function ImageGenModelGalleryWidget({
  payload,
  onAction,
  companyId,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
  companyId: string;
}) {
  const [tab, setTab] = useState<'male' | 'female' | 'kids'>('female');
  const models = (payload.models as CatalogItem[]) ?? [];
  const filtered = models.filter((m) => m.category === tab);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(['male', 'female', 'kids'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTab(c)}
            className={`rounded-full px-3 py-1 text-[12px] capitalize ${tab === c ? 'bg-primary text-primary-foreground' : 'border'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <CatalogGalleryWithUpload
        items={filtered}
        onSelect={onAction}
        action="imageGen.modelSelected"
        payloadKey="modelId"
        uploadRole="model"
        companyId={companyId}
        uploadLabel="Upload your own model"
      />
    </div>
  );
}

export function ImageGenBackgroundGalleryWidget({
  payload,
  onAction,
  companyId,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
  companyId: string;
}) {
  const backgrounds = (payload.backgrounds as CatalogItem[]) ?? [];
  return (
    <CatalogGalleryWithUpload
      items={backgrounds}
      onSelect={onAction}
      action="imageGen.backgroundSelected"
      payloadKey="backgroundId"
      uploadRole="background"
      companyId={companyId}
      uploadLabel="Upload your own background"
    />
  );
}

export function ImageGenPoseGalleryWidget({
  payload,
  onAction,
  companyId,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
  companyId: string;
}) {
  const poses = (payload.poses as CatalogItem[]) ?? [];
  return (
    <CatalogGalleryWithUpload
      items={poses}
      onSelect={onAction}
      action="imageGen.poseSelected"
      payloadKey="poseId"
      uploadRole="pose"
      companyId={companyId}
      uploadLabel="Upload your own pose reference"
    />
  );
}

export function ImageGenPushToAdsWidget({
  payload,
  workflowState,
  onAction,
}: {
  payload: Record<string, unknown>;
  workflowState: WorkflowState;
  onAction: ChatWidgetDispatch;
}) {
  const fromPayload = (payload.assetIds as string[]) ?? [];
  const fromState = workflowState.imageGen?.generatedAssets?.map((g) => g.assetId) ?? [];
  const assetIds = fromPayload.length ? fromPayload : fromState;

  if (!assetIds.length) return null;

  return (
    <button
      type="button"
      onClick={() => void onAction('imageGen.pushToAds', { assetIds }, 'Post to ads')}
      className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
    >
      Post {assetIds.length} image{assetIds.length > 1 ? 's' : ''} to ads
    </button>
  );
}
