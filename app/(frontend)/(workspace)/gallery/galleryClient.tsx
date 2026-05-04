"use client";

import { useCallback, useEffect, useState } from "react";

import VideoPlayer from "@/app/components/Video/VideoPlayer";
import { UploadZone } from "@/app/components/UI/uploadZone";
import { Film, ImageIcon, FileText, Play, RefreshCw, X } from "lucide-react";

type AssetType = "VIDEO" | "IMAGE" | "DOCUMENT";

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
  createdAt: string;
  streamId: string | null;
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

interface Props {
  companyId: string;
}

export default function GalleryClient({ companyId }: Props) {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/gallery/assets", { credentials: "include" });
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
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

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

  return (
    <div className="mx-auto max-w-[100rem] space-y-8 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Gallery
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Uploads and assets for this workspace. Stream videos when playback is ready.
          </p>
        </div>
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

      <UploadZone
        companyId={companyId}
        onUploadStart={() => {
          window.setTimeout(() => void loadAssets(), 3500);
        }}
      />

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
          No assets yet. Upload video or images above.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            disabled={openingId === asset.id}
            onClick={() => void openAsset(asset)}
            className="group glass-card overflow-hidden rounded-2xl p-0 text-left transition hover:border-primary/30 disabled:opacity-60"
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
            <div className="space-y-1 px-4 py-3">
              <p className="truncate font-medium text-foreground">
                {asset.title || asset.filename}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {asset.filename}
              </p>
            </div>
          </button>
        ))}
      </div>

      {preview?.kind === "video" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
        </div>
      ) : null}

      {preview?.kind === "image" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
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
        </div>
      ) : null}
    </div>
  );
}
