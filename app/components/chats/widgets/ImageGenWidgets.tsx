'use client';

import { useCallback, useEffect, useState } from 'react';

import { useUploader } from '@/app/hooks/useUploader';
import type { WorkflowState } from '@/lib/chats/types';

import type { ChatWidgetDispatch } from './ChatWidgets';

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
      <p className="text-[13px] text-muted-foreground">
        No Shopify products synced. Connect Shopify or use custom upload.
      </p>
    );
  }

  return (
    <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() =>
            void onAction('imageGen.shopifySelected', { productId: p.id }, `Product: ${p.title}`)
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
        await onAction(
          'imageGen.uploaded',
          { assetId },
          `Uploaded ${files.length} image(s)`,
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
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const imageUrl = payload.imageUrl as string | undefined;
  const mode = payload.mode as string | undefined;

  return (
    <div className="space-y-3">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Generated" className="max-h-80 rounded-lg border object-contain" />
      )}
      <div className="flex flex-wrap gap-2">
        {mode === 'productAd' && (
          <button
            type="button"
            onClick={() => void onAction('imageGen.baseAccepted', {}, 'Accept — create variants')}
            className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            Accept & create variants
          </button>
        )}
        {mode === 'productOnModel' && (
          <button
            type="button"
            onClick={() => void onAction('imageGen.onModelAccepted', {}, 'Looks good')}
            className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground"
          >
            Looks good
          </button>
        )}
        <button
          type="button"
          onClick={() => void onAction('imageGen.baseRejected', {}, 'Request changes')}
          className="rounded-full border border-border/50 px-4 py-1.5 text-[13px] font-medium"
        >
          Request changes
        </button>
      </div>
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
  const ideas = (payload.ideas as string[]) ?? [];
  const [edits, setEdits] = useState<Record<number, string>>({});

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {ideas.map((label, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="font-medium text-muted-foreground">{i + 1}.</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <details className="text-[12px] text-muted-foreground">
        <summary className="cursor-pointer">Change an idea</summary>
        <div className="mt-2 space-y-2">
          {ideas.map((label, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-6 shrink-0 pt-2">{i + 1}.</span>
              <input
                className="flex-1 rounded border border-border/50 bg-background px-2 py-1 text-[12px]"
                placeholder={`New direction for "${label}"`}
                value={edits[i] ?? ''}
                onChange={(e) => setEdits((prev) => ({ ...prev, [i]: e.target.value }))}
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
            Apply idea changes
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.imageUrl} alt="" className="aspect-square w-full rounded object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded bg-muted text-[11px] text-muted-foreground">
              {v.status === 'failed' ? v.error ?? 'Failed' : 'Pending'}
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
            void onSelect(action, { [payloadKey]: item.id }, item.label)
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

export function ImageGenModelGalleryWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
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
      <CatalogGallery
        items={filtered}
        onSelect={onAction}
        action="imageGen.modelSelected"
        payloadKey="modelId"
      />
    </div>
  );
}

export function ImageGenBackgroundGalleryWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const backgrounds = (payload.backgrounds as CatalogItem[]) ?? [];
  return (
    <CatalogGallery
      items={backgrounds}
      onSelect={onAction}
      action="imageGen.backgroundSelected"
      payloadKey="backgroundId"
    />
  );
}

export function ImageGenPoseGalleryWidget({
  payload,
  onAction,
}: {
  payload: Record<string, unknown>;
  onAction: ChatWidgetDispatch;
}) {
  const poses = (payload.poses as CatalogItem[]) ?? [];
  return (
    <CatalogGallery
      items={poses}
      onSelect={onAction}
      action="imageGen.poseSelected"
      payloadKey="poseId"
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
