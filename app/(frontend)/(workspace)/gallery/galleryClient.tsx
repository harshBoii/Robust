"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import VideoPlayer from "@/app/components/Video/VideoPlayer";
import { UploadZone } from "@/app/components/UI/uploadZone";
import {
  Film,
  ImageIcon,
  FileText,
  Folder,
  LayoutGrid,
  Layers,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Check,
  X,
  Download,
  Trash2,
} from "lucide-react";

type AssetType = "VIDEO" | "IMAGE" | "DOCUMENT";

export type GalleryBulk = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export type GalleryAssetBucket = {
  id: string;
  label: string;
  bucketType: string;
  bucketValue: string;
};

export type GalleryAsset = {
  id: string;
  title: string;
  filename: string;
  assetType: AssetType;
  status: string;
  thumbnailUrl: string | null;
  playbackUrl: string | null;
  mimeType: string | null;
  duration: number | null;
  resolution: string | null;
  createdAt: string;
  streamId: string | null;
  bulkUploadId: string | null;
  assetBucketId: string | null;
  bulkUpload: GalleryBulk | null;
  assetBucket: GalleryAssetBucket | null;
};

type PreviewState =
  | {
      kind: "video";
      assetId: string;
      src: string;
      streamKind: "hls" | "progressive";
      poster: string | null;
    }
  | { kind: "image"; src: string; title: string }
  | null;

type ViewMode = "flat" | "bulk";

type BulkGroup = {
  key: string;
  bulk: GalleryBulk | null;
  assets: GalleryAsset[];
};

interface Props {
  companyId: string;
  /** When set, API returns only this asset type (Images / Videos pages). */
  assetTypeFilter?: "IMAGE" | "VIDEO";
  pageTitle?: string;
  pageSubtitle?: string;
  /** Hide folder toggle + folders view (filtered sub-pages). */
  hideFoldersView?: boolean;
  /** Hide inline drop zone (upload from sidebar modal instead). */
  hideInlineUploader?: boolean;
}

const UNGROUPED_KEY = "__ungrouped__";

type UsageTag =
  | "Story material"
  | "Reel material"
  | "Square post"
  | "Portrait post"
  | "Landscape post"
  | "Long-form";

const TAG_STYLES: Record<UsageTag, string> = {
  "Story material": "bg-rose-500/10 text-rose-600 border-rose-500/20",
  "Reel material": "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/25",
  "Square post": "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "Portrait post": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Landscape post": "bg-amber-500/10 text-amber-700 border-amber-500/25",
  "Long-form": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

/**
 * Classify a normalized aspect ratio. Tolerance ~6% so 1080x1920 (0.5625) still
 * lands on 9:16 even with rounding from arbitrary upload sizes.
 */
function classifyAspect(
  width: number,
  height: number,
): "9:16" | "1:1" | "4:5" | "16:9" | "OTHER" {
  const r = width / height;
  const targets: Array<{ key: "9:16" | "1:1" | "4:5" | "16:9"; ratio: number }> = [
    { key: "1:1", ratio: 1 },
    { key: "4:5", ratio: 4 / 5 },
    { key: "9:16", ratio: 9 / 16 },
    { key: "16:9", ratio: 16 / 9 },
  ];
  let best: "9:16" | "1:1" | "4:5" | "16:9" | "OTHER" = "OTHER";
  let bestDiff = Infinity;
  for (const t of targets) {
    const d = Math.abs(r - t.ratio);
    if (d < bestDiff) {
      bestDiff = d;
      best = t.key;
    }
  }
  return bestDiff > 0.06 ? "OTHER" : best;
}

/**
 * Derive social-media usage chips for an asset from its aspect ratio, duration,
 * and asset type. Multiple chips can apply (e.g. a 30s 9:16 video is both
 * "Story material" and "Reel material").
 */
function getUsageTags(asset: GalleryAsset): UsageTag[] {
  const m = asset.resolution
    ? /^(\d+)\s*x\s*(\d+)$/i.exec(asset.resolution.trim())
    : null;
  if (!m) return [];
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) return [];

  const aspect = classifyAspect(w, h);
  const isVideo = asset.assetType === "VIDEO";
  const isImage = asset.assetType === "IMAGE";
  const dur = asset.duration ?? 0;

  const tags: UsageTag[] = [];

  // Story: 9:16 image, or 9:16 video ≤60s
  if (aspect === "9:16" && (isImage || (isVideo && dur > 0 && dur <= 60))) {
    tags.push("Story material");
  }
  // Reel: 9:16 video 5–90s
  if (aspect === "9:16" && isVideo && dur >= 5 && dur <= 90) {
    tags.push("Reel material");
  }
  // Square post: 1:1 image, or 1:1 video ≤90s
  if (aspect === "1:1" && (isImage || (isVideo && dur > 0 && dur <= 90))) {
    tags.push("Square post");
  }
  // Portrait post: 4:5 image, or 4:5 video ≤90s
  if (aspect === "4:5" && (isImage || (isVideo && dur > 0 && dur <= 90))) {
    tags.push("Portrait post");
  }
  // Landscape post: 16:9 image, or 16:9 video ≤60s
  if (aspect === "16:9" && (isImage || (isVideo && dur > 0 && dur <= 60))) {
    tags.push("Landscape post");
  }
  // Long-form: any video > 3 min
  if (isVideo && dur > 180) {
    tags.push("Long-form");
  }

  return tags;
}

function buildBulkGroups(assets: GalleryAsset[]): BulkGroup[] {
  const map = new Map<string, { bulk: GalleryBulk | null; assets: GalleryAsset[] }>();
  for (const a of assets) {
    const key = a.bulkUploadId ?? UNGROUPED_KEY;
    if (!map.has(key)) {
      map.set(key, {
        bulk: a.bulkUpload ?? null,
        assets: [],
      });
    }
    map.get(key)!.assets.push(a);
  }
  const rows = [...map.entries()].map(([key, v]) => ({ key, ...v }));
  rows.sort((a, b) => {
    if (a.key === UNGROUPED_KEY) return 1;
    if (b.key === UNGROUPED_KEY) return -1;
    const ta = a.bulk?.createdAt ? Date.parse(a.bulk.createdAt) : 0;
    const tb = b.bulk?.createdAt ? Date.parse(b.bulk.createdAt) : 0;
    return tb - ta;
  });
  return rows;
}

function BulkSessionHeader({
  bulk,
  assetCount,
  onRenamed,
  variant = "card",
}: {
  bulk: GalleryBulk | null;
  assetCount: number;
  onRenamed: () => void;
  variant?: "card" | "plain";
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(bulk?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(bulk?.name ?? "");
  }, [bulk?.id, bulk?.name]);

  const save = async () => {
    if (!bulk) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === bulk.name) {
      setEditing(false);
      setName(bulk.name);
      return;
    }
    setSaving(true);
    setRenameError(null);
    try {
      const res = await fetch(`/api/gallery/bulk-uploads/${bulk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        bulkUpload?: GalleryBulk;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Rename failed");
      }
      if (data.bulkUpload?.name) setName(data.bulkUpload.name);
      setEditing(false);
      onRenamed();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  };

  const title = bulk?.name ?? (bulk ? "Bulk session" : "Not in a batch");

  const shell =
    variant === "card"
      ? "glass-card rounded-2xl px-4 py-3"
      : "rounded-xl px-0 py-1";

  return (
    <div className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing && bulk ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input min-w-[12rem] max-w-md flex-1 rounded-lg px-3 py-2 text-sm text-foreground"
                maxLength={255}
                autoFocus
                disabled={saving}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void save();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setName(bulk.name);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="glass-button-primary rounded-lg px-3 py-2 text-xs font-semibold"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(bulk.name);
                }}
                disabled={saving}
                className="glass-button rounded-lg px-3 py-2 text-xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="truncate font-heading text-lg font-semibold text-foreground">
                {title}
              </h2>
              {bulk ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"
                  title="Rename folder"
                  aria-label="Rename folder"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {assetCount} item{assetCount === 1 ? "" : "s"}
            {bulk ? ` · ${bulk.status}` : ""}
          </p>
          {renameError ? (
            <p className="mt-1 text-xs text-destructive">{renameError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FolderTile({
  group,
  onOpen,
}: {
  group: BulkGroup;
  onOpen: () => void;
}) {
  const { bulk, assets } = group;
  const label =
    bulk?.name ?? (group.key === UNGROUPED_KEY ? "Ungrouped" : "Folder");
  const previews = assets
    .map((a) => a.thumbnailUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group glass-card flex flex-col overflow-hidden rounded-2xl p-0 text-left transition hover:border-primary/35 hover:shadow-[var(--glass-shadow-lg)]"
    >
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-[var(--glass-hover)] to-[var(--glass-bg)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <Folder className="h-16 w-16 text-primary/35 transition group-hover:text-primary/55 group-hover:scale-[1.03]" />
        </div>
        {previews.length > 0 ? (
          <div className="absolute bottom-2 right-2 flex -space-x-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="h-10 w-10 rounded-md border-2 border-[var(--glass-border)] object-cover shadow-md"
                style={{ zIndex: previews.length - i }}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-0.5 px-4 py-3">
        <p className="truncate font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {assets.length} item{assets.length === 1 ? "" : "s"}
        </p>
      </div>
    </button>
  );
}

export default function GalleryClient({
  companyId,
  assetTypeFilter,
  pageTitle = "Gallery",
  pageSubtitle = "Uploads and assets for this workspace. Open a folder to view its files.",
  hideFoldersView = false,
  hideInlineUploader = false,
}: Props) {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteRequestIds, setDeleteRequestIds] = useState<string[] | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [openFolder, setOpenFolder] = useState<BulkGroup | null>(null);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);

  const assetsUrl = useMemo(() => {
    const base = "/api/gallery/assets";
    if (!assetTypeFilter) return base;
    return `${base}?type=${encodeURIComponent(assetTypeFilter)}`;
  }, [assetTypeFilter]);

  const loadAssets = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(assetsUrl, { credentials: "include" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Failed to load assets (${res.status})`);
      }
      const data = (await res.json()) as { assets: GalleryAsset[] };
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load gallery.");
    } finally {
      setLoading(false);
    }
  }, [assetsUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (hideFoldersView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewMode("flat");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenFolder(null);
    }
  }, [hideFoldersView]);

  useEffect(() => {
    const onRefresh = () => void loadAssets();
    window.addEventListener("robust-gallery-refresh", onRefresh);
    return () => window.removeEventListener("robust-gallery-refresh", onRefresh);
  }, [loadAssets]);

  const bulkGroups = useMemo(() => buildBulkGroups(assets), [assets]);

  const openFolderKey = openFolder?.key;
  useEffect(() => {
    if (!openFolderKey) return;
    const next = bulkGroups.find((g) => g.key === openFolderKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next) setOpenFolder(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setOpenFolder(null);
  }, [bulkGroups, openFolderKey]);

  const folderGroupedSections = useMemo(() => {
    if (!openFolder) return null;
    const list = openFolder.assets;
    const hasBuckets = list.some((a) => a.assetBucketId);
    if (!hasBuckets) return null;

    const byBucket = new Map<string, GalleryAsset[]>();
    const other: GalleryAsset[] = [];

    for (const a of list) {
      if (a.assetBucket?.id) {
        const bid = a.assetBucket.id;
        if (!byBucket.has(bid)) byBucket.set(bid, []);
        byBucket.get(bid)!.push(a);
      } else {
        other.push(a);
      }
    }

    type Section = {
      bucketId: string;
      label: string;
      bucketType: string;
      assets: GalleryAsset[];
      groupTag?: string;
    };

    const sections: Section[] = [...byBucket.entries()].map(([bucketId, items]) => ({
      bucketId,
      label: items[0]?.assetBucket?.label ?? "Group",
      bucketType: items[0]?.assetBucket?.bucketType ?? "ASPECT_RATIO",
      assets: items,
    }));
    sections.sort((a, b) => a.label.localeCompare(b.label));

    // Add group indices for CONTENT buckets (group-1, group-2, etc.)
    let contentGroupIndex = 1;
    for (const section of sections) {
      if (section.bucketType === "CONTENT") {
        section.groupTag = `group-${contentGroupIndex}`;
        contentGroupIndex++;
      }
    }

    if (other.length > 0) {
      sections.push({
        bucketId: "__other__",
        label: "Other",
        bucketType: "ASPECT_RATIO",
        assets: other,
      });
    }
    return sections;
  }, [openFolder]);

  const runAnalyzeBulk = useCallback(async (mode: 'metadata' | 'content' = 'metadata') => {
    const bulkId = openFolder?.bulk?.id;
    if (!bulkId) return;
    setAnalyzeBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gallery/bulk-uploads/${bulkId}/analyze`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Grouping failed");
      }
      await loadAssets();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Grouping failed");
    } finally {
      setAnalyzeBusy(false);
    }
  }, [openFolder?.bulk?.id, loadAssets]);

  const downloadAsset = async (asset: GalleryAsset) => {
    setDownloadingId(asset.id);
    setError(null);
    try {
      const endpoint =
        asset.assetType === "VIDEO"
          ? `/api/videos/${asset.id}/download`
          : `/api/assets/${asset.id}/download`;
      const res = await fetch(endpoint, { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        download?: { url: string; filename: string };
      };
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? "Download failed");
      }
      const url = data.download?.url;
      const filename =
        data.download?.filename ?? asset.filename ?? `asset-${asset.id}`;
      if (!url) throw new Error("No download URL returned");

      try {
        const fileRes = await fetch(url);
        if (!fileRes.ok) throw new Error("Could not fetch file");
        const blob = await fileRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const requestDelete = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)].filter((id) =>
      assets.some((asset) => asset.id === id),
    );
    if (uniqueIds.length > 0) setDeleteRequestIds(uniqueIds);
  };

  const confirmDelete = async () => {
    if (!deleteRequestIds?.length || deletingIds.size > 0) return;

    const ids = deleteRequestIds;
    setDeletingIds(new Set(ids));
    setError(null);
    const deletedIds: string[] = [];
    const failures: string[] = [];

    try {
      // Keep external storage/API traffic bounded for large selections.
      for (let index = 0; index < ids.length; index += 4) {
        const batch = ids.slice(index, index + 4);
        const results = await Promise.all(
          batch.map(async (id) => {
            const res = await fetch(`/api/gallery/assets/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            return { id, ok: res.ok, error: data.error };
          }),
        );

        for (const result of results) {
          if (result.ok) deletedIds.push(result.id);
          else failures.push(result.error ?? "Delete failed");
        }
      }

      if (deletedIds.length > 0) {
        const deleted = new Set(deletedIds);
        setAssets((current) => current.filter((item) => !deleted.has(item.id)));
        setSelectedIds((current) => {
          const next = new Set(current);
          deletedIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failures.length > 0) {
        setError(
          `${failures.length} asset${failures.length === 1 ? "" : "s"} could not be deleted. ${failures[0]}`,
        );
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingIds(new Set());
      setDeleteRequestIds(null);
    }
  };

  useEffect(() => {
    if (!deleteRequestIds || deletingIds.size > 0) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteRequestIds(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [deleteRequestIds, deletingIds.size]);

  const openAsset = async (asset: GalleryAsset) => {
    setOpeningId(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}/url`, {
        credentials: "include",
      });
      if (res.status === 202) {
        setError("Video is still processing. Try again in a few seconds.");
        return;
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Could not get playback URL.");
      }
      const data = (await res.json()) as {
        url: string;
        type: "hls" | "r2";
      };

      if (asset.assetType === "VIDEO") {
        setPreview({
          kind: "video",
          assetId: asset.id,
          src: data.url,
          streamKind: data.type === "hls" ? "hls" : "progressive",
          poster: asset.thumbnailUrl,
        });
        return;
      }
      if (asset.assetType === "IMAGE") {
        setPreview({
          kind: "image",
          src: data.url,
          title: asset.title || asset.filename,
        });
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Open failed.");
    } finally {
      setOpeningId(null);
    }
  };

  const renderAssetCard = (asset: GalleryAsset) => {
    const usageTags = getUsageTags(asset);
    const isSelected = selectedIds.has(asset.id);
    const isBusy =
      openingId === asset.id ||
      downloadingId === asset.id ||
      deletingIds.has(asset.id);
    return (
      <div
        key={asset.id}
        className={`group glass-card relative overflow-hidden rounded-2xl p-0 text-left transition hover:border-primary/30 ${
          isSelected ? "border-primary/60 ring-2 ring-primary/25" : ""
        }`}
      >
        <label className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-black/65 shadow-sm backdrop-blur-sm">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isBusy}
            onChange={(event) => {
              setSelectedIds((current) => {
                const next = new Set(current);
                if (event.target.checked) next.add(asset.id);
                else next.delete(asset.id);
                return next;
              });
            }}
            className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
            aria-label={`Select ${asset.title || asset.filename}`}
          />
        </label>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void openAsset(asset)}
          className="block w-full text-left disabled:opacity-60"
        >
          <div className="relative aspect-video w-full bg-[var(--glass-hover)]">
            {asset.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                {asset.assetType === "VIDEO" ? (
                  <Film className="h-10 w-10 opacity-40" />
                ) : asset.assetType === "IMAGE" ? (
                  <ImageIcon className="h-10 w-10 opacity-40" />
                ) : (
                  <FileText className="h-10 w-10 opacity-40" />
                )}
              </div>
            )}
            {asset.assetType === "VIDEO" && (
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                <Play className="h-3 w-3" /> Stream
              </span>
            )}
            <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
              {asset.status}
            </span>
          </div>
        </button>
        <div className="space-y-1 px-4 py-3">
          <p className="truncate font-medium text-foreground">
            {asset.title || asset.filename}
          </p>
          <p className="truncate text-xs text-muted-foreground">{asset.filename}</p>
          {usageTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1.5">
              {usageTags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${TAG_STYLES[tag]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void downloadAsset(asset)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-[var(--glass-hover)] hover:text-foreground disabled:opacity-50"
            >
              {downloadingId === asset.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => requestDelete([asset.id])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/25 px-2.5 py-1.5 text-xs font-medium text-destructive transition hover:border-destructive/45 hover:bg-destructive/10 disabled:opacity-50"
              aria-label={`Delete ${asset.title || asset.filename}`}
            >
              {deletingIds.has(asset.id) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSelectionToolbar = (viewAssets: GalleryAsset[]) => {
    const viewIds = viewAssets.map((asset) => asset.id);
    const selectedInView = viewIds.filter((id) => selectedIds.has(id));
    const allSelected =
      viewIds.length > 0 && selectedInView.length === viewIds.length;

    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => {
                setSelectedIds((current) => {
                  const next = new Set(current);
                  viewIds.forEach((id) => {
                    if (event.target.checked) next.add(id);
                    else next.delete(id);
                  });
                  return next;
                });
              }}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Select all
          </label>
          <span className="text-xs text-muted-foreground">
            {selectedInView.length} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedInView.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelectedIds((current) => {
                  const next = new Set(current);
                  viewIds.forEach((id) => next.delete(id));
                  return next;
                });
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            disabled={selectedInView.length === 0 || deletingIds.size > 0}
            onClick={() => requestDelete(selectedInView)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete selected
          </button>
        </div>
      </div>
    );
  };

  const gridClass =
    "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";

  const folderGridClass =
    "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[100rem] flex-1 flex-col overflow-hidden p-6">
      <div className="shrink-0 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!hideFoldersView ? (
          <div
            className="glass inline-flex rounded-xl border border-[var(--glass-border)] p-1"
            role="group"
            aria-label="Gallery layout"
          >
            <button
              type="button"
              onClick={() => {
                setViewMode("flat");
                setOpenFolder(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                viewMode === "flat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              All assets
            </button>
            <button
              type="button"
              onClick={() => setViewMode("bulk")}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                viewMode === "bulk"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-4 w-4" />
              Folders
            </button>
          </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadAssets();
            }}
            disabled={loading}
            className="glass-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {!hideInlineUploader ? (
        <UploadZone
          companyId={companyId}
          onUploadStart={() => {
            window.setTimeout(() => void loadAssets(), 3500);
          }}
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading assets…</p>
      ) : null}

      {!loading && assets.length === 0 ? (
        <div className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
          {hideInlineUploader
            ? "No assets yet. Use Upload Assets in the sidebar to add files."
            : "No assets yet. Upload video or images above."}
        </div>
      ) : null}
      </div>

      {assets.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar pt-8">
          {viewMode === "flat" ? (
            <>
              {renderSelectionToolbar(assets)}
              <div className={gridClass}>{assets.map(renderAssetCard)}</div>
            </>
          ) : !hideFoldersView ? (
            <div className={folderGridClass}>
              {bulkGroups.map((group) => (
                <FolderTile
                  key={group.key}
                  group={group}
                  onOpen={() => setOpenFolder(group)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {openFolder && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-modal flex items-stretch justify-center bg-white p-0 sm:p-6 sm:items-center"
              role="presentation"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
                aria-label="Close folder"
                onClick={() => setOpenFolder(null)}
              />
              <div
                role="dialog"
                aria-modal
                aria-label={
                  openFolder.bulk?.name ??
                  (openFolder.key === UNGROUPED_KEY ? "Ungrouped" : "Folder")
                }
                className="relative z-10 flex h-full w-full max-h-full flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl sm:border"
                onClick={(e) => e.stopPropagation()}
              >
            <div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-[var(--glass-border)] px-4 py-3 sm:px-5">
              <div className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--glass-hover)] sm:flex">
                <Folder className="h-5 w-5 text-primary/70" />
              </div>
              <div className="min-w-0 flex-1">
                <BulkSessionHeader
                  bulk={openFolder.bulk}
                  assetCount={openFolder.assets.length}
                  onRenamed={() => void loadAssets()}
                  variant="plain"
                />
              </div>
              {openFolder.bulk ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={analyzeBusy}
                    onClick={() => void runAnalyzeBulk('metadata')}
                    className="glass-button mt-0.5 inline-flex shrink-0 items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60"
                  >
                    {analyzeBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {openFolder.assets.some((a) => a.assetBucketId)
                      ? "Re-group by metadata"
                      : "Group by metadata"}
                  </button>
                  <button
                    type="button"
                    disabled={analyzeBusy}
                    onClick={() => void runAnalyzeBulk('content')}
                    className="glass-button-primary mt-0.5 inline-flex shrink-0 items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {analyzeBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Layers className="h-4 w-4" />
                    )}
                    Group by content
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setOpenFolder(null)}
                className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto glass-scrollbar px-4 py-4 sm:px-5 sm:py-5">
              {renderSelectionToolbar(openFolder.assets)}
              {folderGroupedSections ? (
                <div className="space-y-8">
                  {folderGroupedSections.map((section) => (
                    <section key={section.bucketId} className="space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {section.label}
                        {section.groupTag && (
                          <span className="inline-flex items-center rounded-full bg-clipfox-primary/15 px-2 py-0.5 text-[11px] font-medium text-clipfox-primary">
                            {section.groupTag}
                          </span>
                        )}
                        <span className="ml-1 font-normal text-muted-foreground">
                          · {section.assets.length} item
                          {section.assets.length === 1 ? "" : "s"}
                        </span>
                      </h3>
                      <div className={gridClass}>
                        {section.assets.map(renderAssetCard)}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className={gridClass}>
                  {openFolder.assets.map(renderAssetCard)}
                </div>
              )}
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}

      {deleteRequestIds && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-label="Cancel deletion"
                disabled={deletingIds.size > 0}
                onClick={() => setDeleteRequestIds(null)}
              />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-assets-title"
                aria-describedby="delete-assets-description"
                className="glass-modal relative z-10 w-full max-w-md rounded-2xl border border-destructive/20 p-6 shadow-2xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Trash2 className="h-5 w-5" />
                </div>
                <h2
                  id="delete-assets-title"
                  className="font-heading text-xl font-semibold text-foreground"
                >
                  Delete {deleteRequestIds.length} asset
                  {deleteRequestIds.length === 1 ? "" : "s"}?
                </h2>
                <p
                  id="delete-assets-description"
                  className="mt-2 text-sm leading-6 text-muted-foreground"
                >
                  This permanently removes the selected{" "}
                  {deleteRequestIds.length === 1 ? "file" : "files"} from storage.
                  This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={deletingIds.size > 0}
                    onClick={() => setDeleteRequestIds(null)}
                    autoFocus
                    className="glass-button rounded-xl px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingIds.size > 0}
                    onClick={() => void confirmDelete()}
                    className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-60"
                  >
                    {deletingIds.size > 0 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {deletingIds.size > 0 ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {preview?.kind === "video" && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              role="presentation"
              onClick={() => setPreview(null)}
            >
          <div
            className="glass-modal relative w-full max-w-4xl overflow-hidden rounded-2xl p-4 shadow-2xl"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--glass-hover)] hover:text-foreground"
              onClick={() => setPreview(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <VideoPlayer
              src={preview.src}
              streamKind={preview.streamKind}
              poster={preview.poster}
              className="mt-2 w-full max-h-[72vh] rounded-xl bg-black"
            />
          </div>
        </div>,
            document.body,
          )
        : null}

      {preview?.kind === "image" && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
              onClick={() => setPreview(null)}
              role="presentation"
            >
          <div
            className="glass-modal relative max-h-[90vh] max-w-5xl overflow-auto rounded-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted-foreground hover:bg-[var(--glass-hover)]"
              onClick={() => setPreview(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.title}
              className="max-h-[85vh] w-auto max-w-full rounded-lg"
            />
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
}
