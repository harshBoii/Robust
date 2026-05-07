import { GetObjectCommand } from "@aws-sdk/client-s3";
import sizeOf from "image-size";

import { prisma } from "@/lib/prisma";
import { r2 } from "@/lib/cloudfare/r2";
import {
  AssetStatus,
  AssetType,
  BucketType,
} from "@/app/generated/prisma/enums";
import type { Asset, AssetBucket, Prisma } from "@/app/generated/prisma/client";
// Legacy: perceptual hashing (disabled; duration-only grouping for now)
// import { getOrComputeMultiFrameHashes } from "./video-hash";

/** Stable bucket key segment values */
export type ResolutionTier = "SD" | "HD" | "FHD" | "QHD" | "FOURK" | "UNKNOWN";
export type DurationTier =
  | "SHORT"
  | "STANDARD"
  | "MEDIUM"
  | "LONG"
  | "EXTRA_LONG"
  | "STILL"
  | "UNKNOWN";

const ASPECT_TARGETS: { key: string; ratio: number }[] = [
  { key: "1:1", ratio: 1 },
  { key: "4:5", ratio: 4 / 5 },
  { key: "9:16", ratio: 9 / 16 },
  { key: "16:9", ratio: 16 / 9 },
  { key: "4:3", ratio: 4 / 3 },
  { key: "3:4", ratio: 3 / 4 },
  { key: "21:9", ratio: 21 / 9 },
];

const RATIO_TOLERANCE = 0.04;

export function parseResolutionString(
  resolution: string | null,
): { width: number; height: number } | null {
  if (!resolution) return null;
  const m = /^(\d+)\s*x\s*(\d+)$/i.exec(resolution.trim());
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }
  return { width, height };
}

export function aspectRatioBin(width: number, height: number): string {
  const r = width / height;
  let best = "OTHER";
  let bestDiff = Infinity;
  for (const { key, ratio } of ASPECT_TARGETS) {
    const d = Math.abs(r - ratio);
    if (d < bestDiff) {
      bestDiff = d;
      best = key;
    }
  }
  if (bestDiff > RATIO_TOLERANCE) return "OTHER";
  return best;
}

export function resolutionTier(width: number, height: number): ResolutionTier {
  const maxDim = Math.max(width, height);
  if (maxDim < 720) return "SD";
  if (maxDim < 1080) return "HD";
  if (maxDim < 1440) return "FHD";
  if (maxDim < 2160) return "QHD";
  return "FOURK";
}

export function durationTierSeconds(seconds: number | null | undefined, assetType: AssetType): DurationTier {
  if (assetType !== "VIDEO") {
    if (assetType === "IMAGE") return "STILL";
    return "UNKNOWN";
  }
  if (seconds == null || !Number.isFinite(seconds)) return "UNKNOWN";
  const s = Math.floor(seconds);
  if (s < 15) return "SHORT";
  if (s <= 30) return "STANDARD";
  if (s <= 60) return "MEDIUM";
  if (s <= 180) return "LONG";
  return "EXTRA_LONG";
}

function tierDisplay(res: ResolutionTier): string {
  switch (res) {
    case "SD":
      return "<720p";
    case "HD":
      return "720p";
    case "FHD":
      return "1080p";
    case "QHD":
      return "1440p";
    case "FOURK":
      return "4K";
    default:
      return "Unknown res";
  }
}

function durationTierDisplay(tier: DurationTier): string {
  switch (tier) {
    case "SHORT":
      return "<15s";
    case "STANDARD":
      return "15–30s";
    case "MEDIUM":
      return "31–60s";
    case "LONG":
      return "1–3m";
    case "EXTRA_LONG":
      return ">3m";
    case "STILL":
      return "Still";
    default:
      return "Unknown";
  }
}

function assetTypeDisplay(t: AssetType): string {
  switch (t) {
    case "VIDEO":
      return "Video";
    case "IMAGE":
      return "Image";
    default:
      return "Document";
  }
}

export type BucketDescriptor = {
  bucketValue: string;
  label: string;
  bucketType: (typeof BucketType)[keyof typeof BucketType];
};

export function computeBucketDescriptor(
  assetType: AssetType,
  width: number | null,
  height: number | null,
  durationSec: number | null | undefined,
): BucketDescriptor {
  const ar =
    width != null && height != null && width > 0 && height > 0
      ? aspectRatioBin(width, height)
      : "OTHER";
  const resTier =
    width != null && height != null && width > 0 && height > 0
      ? resolutionTier(width, height)
      : "UNKNOWN";
  const durTier = durationTierSeconds(durationSec, assetType);

  const bucketValue = `${assetType}|${ar}|${resTier}|${durTier}`;

  const parts: string[] = [];
  if (ar !== "OTHER") parts.push(ar);
  else parts.push("—");
  parts.push(tierDisplay(resTier));
  parts.push(durationTierDisplay(durTier));
  parts.push(assetTypeDisplay(assetType));

  const label = parts.join(" · ");

  return {
    bucketValue,
    label,
    bucketType: BucketType.ASPECT_RATIO,
  };
}

/** First 64 KB is enough for image-size on JPEG/PNG/WebP headers. */
const RANGE_PROBE = "bytes=0-65535";

export async function probeImageDimensions(
  r2Key: string,
  r2Bucket: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const res = await r2.send(
      new GetObjectCommand({
        Bucket: r2Bucket,
        Key: r2Key,
        Range: RANGE_PROBE,
      }),
    );
    const body = res.Body;
    if (!body) return null;

    const buf = Buffer.from(await body.transformToByteArray());
    const dim = sizeOf(buf);
    if (!dim.width || !dim.height) return null;
    return { width: dim.width, height: dim.height };
  } catch (e) {
    console.warn("[analyze-bulk] probeImageDimensions failed", r2Key, e);
    return null;
  }
}

type StreamDetails = {
  duration: number | undefined;
  width: number | undefined;
  height: number | undefined;
};

export async function fetchCloudflareStreamDetails(
  streamId: string,
): Promise<StreamDetails | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    console.warn("[analyze-bulk] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN");
    return null;
  }
  try {
    const detailsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
    if (!detailsResponse.ok) return null;
    const detailsData = (await detailsResponse.json()) as {
      success?: boolean;
      result?: {
        duration?: number;
        input?: { width?: number; height?: number };
      };
    };
    const r = detailsData.result;
    if (!r) return null;
    return {
      duration: r.duration,
      width: r.input?.width,
      height: r.input?.height,
    };
  } catch (e) {
    console.warn("[analyze-bulk] fetchCloudflareStreamDetails failed", streamId, e);
    return null;
  }
}

async function ensureAssetMetrics(asset: Asset): Promise<{
  width: number | null;
  height: number | null;
  durationSec: number | null;
}> {
  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null =
    asset.duration != null && asset.duration > 0 ? asset.duration : null;

  const parsed = parseResolutionString(asset.resolution);
  if (parsed) {
    width = parsed.width;
    height = parsed.height;
  }

  if (asset.assetType === "VIDEO") {
    let rawDurationSec: number | null = null;
    if ((!width || !height || durationSec == null) && asset.streamId) {
      const details = await fetchCloudflareStreamDetails(asset.streamId);
      if (details?.width && details?.height) {
        width = details.width;
        height = details.height;
      }
      if (details?.duration != null && details.duration > 0) {
        rawDurationSec = details.duration;
        durationSec = Math.round(details.duration);
      }
    }
    const updateData: Prisma.AssetUpdateInput = {};
    if (width && height) {
      updateData.resolution = `${width}x${height}`;
    }
    if (durationSec != null && durationSec > 0) {
      updateData.duration = durationSec;
    }
    if (rawDurationSec != null && rawDurationSec > 0) {
      const meta = (asset.metadata as Record<string, unknown> | null) ?? {};
      updateData.metadata = {
        ...meta,
        rawDurationSec,
        durationMs: Math.round(rawDurationSec * 1000),
      } satisfies Prisma.InputJsonValue;
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: updateData,
      });
    }
    return { width, height, durationSec };
  }

  if (asset.assetType === "IMAGE") {
    if (!width || !height) {
      const dim = await probeImageDimensions(asset.r2Key, asset.r2Bucket);
      if (dim) {
        width = dim.width;
        height = dim.height;
        const meta = (asset.metadata as Record<string, unknown> | null) ?? {};
        const nextMeta: Prisma.InputJsonValue = {
          ...meta,
          probedWidth: width,
          probedHeight: height,
          aspectRatio:
            width && height ? Number((width / height).toFixed(4)) : undefined,
        };
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            resolution: `${width}x${height}`,
            metadata: nextMeta,
          },
        });
      }
    }
    return { width, height, durationSec: null };
  }

  // DOCUMENT — try image probe for PDF thumbs etc. usually fails; fall through UNKNOWN
  if (!width || !height) {
    const dim = await probeImageDimensions(asset.r2Key, asset.r2Bucket);
    if (dim) {
      width = dim.width;
      height = dim.height;
      await prisma.asset.update({
        where: { id: asset.id },
        data: { resolution: `${width}x${height}` },
      });
    }
  }
  return { width, height, durationSec: null };
}

export async function maybeAnalyzeBulkUpload(bulkUploadId: string | null | undefined) {
  if (!bulkUploadId) return;
  const pending = await prisma.asset.count({
    where: {
      bulkUploadId,
      status: { in: [AssetStatus.UPLOADING, AssetStatus.PROCESSING] },
    },
  });
  if (pending > 0) return;
  try {
    const bulk = await prisma.bulkUpload.findUnique({
      where: { id: bulkUploadId },
      select: { companyId: true },
    });
    if (!bulk) return;
    await analyzeBulkUpload(bulkUploadId, bulk.companyId);
  } catch (e) {
    console.error("[analyze-bulk] maybeAnalyzeBulkUpload failed", bulkUploadId, e);
  }
}

export type AnalyzeBulkResult = {
  buckets: Pick<AssetBucket, "id" | "label" | "bucketValue" | "bucketType">[];
  assigned: number;
  skipped: number;
};

/**
 * Content mode currently groups videos ONLY by exact millisecond duration.
 * (Perceptual hashing clustering is intentionally disabled for now.)
 * Non-video assets still use metadata bucketing.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Step 1: exact millisecond duration grouping ───────────────────────────────

function assetDurationMs(asset: { duration: number | null; metadata: unknown }): number | null {
  const meta = (asset.metadata as Record<string, unknown> | null) ?? null;
  const msFromMeta = meta?.durationMs;
  if (typeof msFromMeta === "number" && Number.isFinite(msFromMeta) && msFromMeta > 0) {
    return Math.round(msFromMeta);
  }

  const rawSec = meta?.rawDurationSec;
  if (typeof rawSec === "number" && Number.isFinite(rawSec) && rawSec > 0) {
    return Math.round(rawSec * 1000);
  }

  if (asset.duration == null || !Number.isFinite(asset.duration) || asset.duration <= 0) {
    return null;
  }
  return Math.round(asset.duration * 1000);
}

function groupByExactDurationMs(
  assets: { id: string; duration: number | null; metadata: unknown }[],
): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const asset of assets) {
    const ms = assetDurationMs(asset);
    if (ms == null) continue;
    if (!groups.has(ms)) groups.set(ms, []);
    groups.get(ms)!.push(asset.id);
  }
  return groups;
}

async function analyzeByContent(
  assets: Asset[],
  bulkUploadId: string,
  companyId: string,
): Promise<AnalyzeBulkResult> {
  // Separate videos and non-videos
  const videos = assets.filter(
    (a) =>
      a.assetType === AssetType.VIDEO &&
      a.status === AssetStatus.READY &&
      a.thumbnailUrl,
  );
  const nonVideos = assets.filter(
    (a) => a.assetType !== AssetType.VIDEO && a.status === AssetStatus.READY,
  );

  // Ensure any invalid/missing durations (e.g. -1) are refreshed from Stream when possible.
  for (const v of videos) {
    if (assetDurationMs(v) == null) {
      await ensureAssetMetrics(v);
    }
  }

  // ── Phase 1: group by exact millisecond duration ────────────────────────────
  const durationGroups = groupByExactDurationMs(videos);

  // Legacy: perceptual hashing computation is disabled for now.
  // Grouping is strictly by exact duration (no perceptual comparisons).
  // for (const [, assetIds] of durationGroups) { ... }

  // Videos with unknown duration still need a bucket (singleton).
  const unknownDurationVideoIds = videos
    .filter((v) => assetDurationMs(v) == null)
    .map((v) => v.id);

  // Step 4: Compute metadata buckets for non-videos (existing logic)
  const nonVideoDescriptors = new Map<
    string,
    { desc: BucketDescriptor; assetIds: string[] }
  >();

  for (const asset of nonVideos) {
    const metrics = await ensureAssetMetrics(asset);
    const desc = computeBucketDescriptor(
      asset.assetType,
      metrics.width,
      metrics.height,
      metrics.durationSec,
    );

    const existing = nonVideoDescriptors.get(desc.bucketValue);
    if (existing) {
      existing.assetIds.push(asset.id);
    } else {
      nonVideoDescriptors.set(desc.bucketValue, {
        desc,
        assetIds: [asset.id],
      });
    }
  }

  // Step 5: Create buckets in transaction
  const createdBuckets = await prisma.$transaction(async (tx) => {
    await tx.asset.updateMany({
      where: { bulkUploadId, companyId },
      data: { assetBucketId: null },
    });

    await tx.assetBucket.deleteMany({
      where: { bulkUploadId, companyId },
    });

    const bucketRows: AssetBucket[] = [];

    // Create duration buckets for videos (including singletons)
    for (const [ms, assetIds] of durationGroups) {
      const seconds = (ms / 1000).toFixed(2).replace(/\.00$/, "");
      const row = await tx.assetBucket.create({
        data: {
          companyId,
          bulkUploadId,
          label: `${seconds}s · ${assetIds.length} video${assetIds.length !== 1 ? "s" : ""}`,
          bucketType: BucketType.DURATION,
          bucketValue: `durationMs|${ms}`,
        },
      });
      bucketRows.push(row);
      await tx.asset.updateMany({
        where: { id: { in: assetIds }, companyId },
        data: { assetBucketId: row.id },
      });
    }

    for (const assetId of unknownDurationVideoIds) {
      const row = await tx.assetBucket.create({
        data: {
          companyId,
          bulkUploadId,
          label: "Solo · 1 video",
          bucketType: BucketType.DURATION,
          bucketValue: `durationMs|unknown|${assetId}`,
        },
      });
      bucketRows.push(row);
      await tx.asset.update({
        where: { id: assetId, companyId },
        data: { assetBucketId: row.id },
      });
    }

    // Create metadata buckets for non-videos
    for (const { desc, assetIds } of nonVideoDescriptors.values()) {
      const row = await tx.assetBucket.create({
        data: {
          companyId,
          bulkUploadId,
          label: desc.label,
          bucketType: desc.bucketType,
          bucketValue: desc.bucketValue,
        },
      });
      bucketRows.push(row);
      await tx.asset.updateMany({
        where: { id: { in: assetIds }, companyId },
        data: { assetBucketId: row.id },
      });
    }
    return bucketRows;
  });

  const videoAssigned = [...durationGroups.values()].reduce(
    (sum, ids) => sum + ids.length,
    0,
  );
  const nonVideoAssigned = [...nonVideoDescriptors.values()].reduce(
    (sum, g) => sum + g.assetIds.length,
    0,
  );

  return {
    buckets: createdBuckets.map((b) => ({
      id: b.id,
      label: b.label,
      bucketValue: b.bucketValue,
      bucketType: b.bucketType,
    })),
    assigned: videoAssigned + nonVideoAssigned,
    skipped: assets.length - videoAssigned - nonVideoAssigned,
  };
}

/**
 * Groups all READY assets in the bulk into AssetBuckets. Non-READY assets keep assetBucketId null.
 * Replaces existing buckets for this bulk upload (clean re-run).
 */
export async function analyzeBulkUpload(
  bulkUploadId: string,
  companyId: string,
  mode: 'metadata' | 'content' = 'metadata',
): Promise<AnalyzeBulkResult> {
  const bulk = await prisma.bulkUpload.findFirst({
    where: { id: bulkUploadId, companyId },
    select: { id: true },
  });
  if (!bulk) {
    throw new Error("Bulk upload not found");
  }

  const assets = await prisma.asset.findMany({
    where: { bulkUploadId, companyId },
  });

  // Content mode: use perceptual hashing for videos
  if (mode === 'content') {
    return analyzeByContent(assets, bulkUploadId, companyId);
  }

  // Metadata mode: existing aspect ratio + resolution + duration bucketing
  const descriptors = new Map<
    string,
    { desc: BucketDescriptor; assetIds: string[] }
  >();

  const results = await Promise.allSettled(
    assets.map(async (asset) => {
      if (asset.status !== AssetStatus.READY) {
        return { assetId: asset.id, descriptor: null as BucketDescriptor | null };
      }
      const metrics = await ensureAssetMetrics(asset);
      const desc = computeBucketDescriptor(
        asset.assetType,
        metrics.width,
        metrics.height,
        metrics.durationSec,
      );
      return { assetId: asset.id, descriptor: desc };
    }),
  );

  let skippedCount = 0;
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[analyze-bulk] asset task failed", r.reason);
      skippedCount++;
      continue;
    }
    const { assetId, descriptor } = r.value;
    if (!descriptor) {
      skippedCount++;
      continue;
    }
    const existing = descriptors.get(descriptor.bucketValue);
    if (existing) {
      existing.assetIds.push(assetId);
    } else {
      descriptors.set(descriptor.bucketValue, {
        desc: descriptor,
        assetIds: [assetId],
      });
    }
  }

  const createdBuckets = await prisma.$transaction(async (tx) => {
    await tx.asset.updateMany({
      where: { bulkUploadId, companyId },
      data: { assetBucketId: null },
    });

    await tx.assetBucket.deleteMany({
      where: { bulkUploadId, companyId },
    });

    const bucketRows: AssetBucket[] = [];
    for (const { desc, assetIds } of descriptors.values()) {
      const row = await tx.assetBucket.create({
        data: {
          companyId,
          bulkUploadId,
          label: desc.label,
          bucketType: desc.bucketType,
          bucketValue: desc.bucketValue,
        },
      });
      bucketRows.push(row);
      await tx.asset.updateMany({
        where: { id: { in: assetIds }, companyId },
        data: { assetBucketId: row.id },
      });
    }
    return bucketRows;
  });

  const bucketedAssetCount = [...descriptors.values()].reduce(
    (sum, g) => sum + g.assetIds.length,
    0,
  );

  return {
    buckets: createdBuckets.map((b) => ({
      id: b.id,
      label: b.label,
      bucketValue: b.bucketValue,
      bucketType: b.bucketType,
    })),
    assigned: bucketedAssetCount,
    skipped: skippedCount,
  };
}
