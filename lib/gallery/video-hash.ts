import 'server-only';

import sharp from 'sharp';
import { prisma } from '@/lib/prisma';

export type AssetWithThumbnail = {
  id: string;
  duration: number | null;
  thumbnailUrl: string | null;
  videoHash: string | null;
};

export type MultiFrameHash = [string, string, string, string, string];

/**
 * Apply N levels of 2D Haar wavelet decomposition and return the LL (low-low) subband.
 * Each level halves resolution: 64x64 -> 32x32 -> 16x16 -> 8x8.
 *
 * The LL subband represents the low-frequency structural content of the image,
 * which is the most robust signal to compression / encoding noise.
 */
function haarLowLowSubband(
  pixels: Uint8Array | Buffer,
  size: number,
  levels: number,
): number[] {
  let current: number[] = Array.from(pixels);
  let dim = size;

  for (let level = 0; level < levels; level++) {
    const newDim = dim >> 1;
    const next: number[] = new Array(newDim * newDim);
    for (let y = 0; y < newDim; y++) {
      for (let x = 0; x < newDim; x++) {
        const a = current[(y * 2) * dim + x * 2];
        const b = current[(y * 2) * dim + x * 2 + 1];
        const c = current[(y * 2 + 1) * dim + x * 2];
        const d = current[(y * 2 + 1) * dim + x * 2 + 1];
        // LL coefficient = mean (Haar low-pass for both axes; sqrt(2)/2 norm cancels in median threshold)
        next[y * newDim + x] = (a + b + c + d) / 4;
      }
    }
    current = next;
    dim = newDim;
  }
  return current;
}

/**
 * Compute Haar wavelet hash (wHash) from an image URL.
 *
 * Pipeline:
 *   1. Fetch image
 *   2. Center-crop to square (avoids aspect-ratio distortion)
 *   3. Resize to 64x64 grayscale (Lanczos)
 *   4. 3-level 2D Haar wavelet decomposition -> 8x8 LL subband
 *   5. Median-threshold the 64 coefficients -> 64-bit hash
 *
 * wHash captures only the lowest-frequency structural content, which makes it
 * robust to JPEG compression, slight crop changes, and different encoder choices.
 *
 * Returns 16-char hex string or null on failure.
 */
export async function computePHash(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());

    // Letterbox to 64x64 with neutral gray padding instead of center-cropping.
    // Center-crop would discard the sides of a 16:9 video and the top/bottom of a
    // 9:16 version of the same content, producing different hashes for what is
    // visually the same source. Gray padding contributes ~0 to LL-band variance
    // and won't shift the median threshold meaningfully.
    const resized = await sharp(buffer)
      .resize(64, 64, {
        fit: 'contain',
        background: { r: 128, g: 128, b: 128 },
        kernel: 'lanczos3',
      })
      .grayscale()
      .raw()
      .toBuffer();

    // 3 levels of Haar -> 8x8 LL subband (64 coefficients)
    const ll = haarLowLowSubband(resized, 64, 3);

    // Median threshold -> 64 bits
    const sorted = [...ll].sort((a, b) => a - b);
    const median = (sorted[31] + sorted[32]) / 2;

    let hashValue = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (ll[i] > median) {
        hashValue |= BigInt(1) << BigInt(63 - i);
      }
    }

    return hashValue.toString(16).padStart(16, '0');
  } catch (err) {
    console.warn('[video-hash] computeWHash failed:', err);
    return null;
  }
}

/**
 * Apply CF Stream resolution normalization to any thumbnail URL.
 *
 * Critical: forces a fixed 64px thumbnail at the CF edge, eliminating per-streamId
 * encoding variation (different upload resolutions produce different JPEG artifacts
 * at full size, but all collapse to the same content at 64px).
 */
function normalizeThumbnail(thumbnailUrl: string): string {
  try {
    const url = new URL(thumbnailUrl);
    url.searchParams.set('height', '64');
    url.searchParams.set('fit', 'crop');
    return url.toString();
  } catch {
    return thumbnailUrl;
  }
}

/**
 * Build a Cloudflare Stream thumbnail URL at a specific timestamp (seconds),
 * with resolution normalization applied. Falls back to the original URL on failure.
 */
function thumbnailAtTime(thumbnailUrl: string, timeSec: number): string {
  try {
    const url = new URL(thumbnailUrl);
    // Keep sub-second precision so short videos don't collapse multiple sample
    // positions onto the same frame.
    url.searchParams.set('time', `${Math.max(0, Number(timeSec.toFixed(1)))}s`);
    url.searchParams.set('height', '64');
    url.searchParams.set('fit', 'crop');
    return url.toString();
  } catch {
    return thumbnailUrl;
  }
}

/**
 * Compute multi-frame hash for a video by sampling thumbnails at 10%, 25%, 50%, 75%, 90%
 * of duration. Returns ":"-joined hex string or null on failure.
 *
 * 5-frame sampling is more robust than 3 frames because:
 *   - Edge frames (0%, 100%) capture content that is far more distinctive than midpoints.
 *   - A talking-head at 50% of any video looks similar across unrelated clips; sampling
 *     the extremes breaks that degeneracy.
 *   - Different CF Stream encodings pick different default frames; 5 samples maximise
 *     overlap probability between two encodings of the same source.
 */
export async function computeMultiFrameHash(
  thumbnailUrl: string,
  durationSec: number | null,
): Promise<string | null> {
  // If we don't have a duration, fall back to a single frame at the default URL
  // (still normalized to 64px so 1080p and 720p variants produce identical bytes).
  if (!durationSec || durationSec < 1) {
    return computePHash(normalizeThumbnail(thumbnailUrl));
  }

  const samplePcts = [0.1, 0.25, 0.5, 0.75, 0.9];
  const hashes = await Promise.all(
    samplePcts.map((pct) =>
      computePHash(thumbnailAtTime(thumbnailUrl, durationSec * pct)),
    ),
  );

  const valid = hashes.filter((h): h is string => Boolean(h));
  if (valid.length === 0) return null;

  return valid.join(':');
}

/**
 * Calculate Hamming distance between two 64-bit hex hashes.
 * Returns number of differing bits (0-64).
 */
export function hammingDistance(a: string, b: string): number {
  const bigA = BigInt(`0x${a}`);
  const bigB = BigInt(`0x${b}`);
  const xor = bigA ^ bigB;

  // Count set bits
  let distance = 0;
  let val = xor;
  while (val > 0) {
    distance += Number(val & BigInt(1));
    val >>= BigInt(1);
  }
  return distance;
}

/**
 * Compare two multi-frame hashes (":"-joined) and return the *minimum* Hamming
 * distance across all frame pairs. Used as one component of the composite gate.
 */
export function bestHammingDistance(a: string, b: string): number {
  const framesA = a.split(':').filter(Boolean);
  const framesB = b.split(':').filter(Boolean);
  if (framesA.length === 0 || framesB.length === 0) return 64;

  let best = 64;
  for (const fa of framesA) {
    for (const fb of framesB) {
      if (fa.length !== 16 || fb.length !== 16) continue;
      const d = hammingDistance(fa, fb);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Average Hamming distance across all cross-frame pairs from two multi-frame hashes.
 * Returns 64 when either hash has no valid frames.
 */
export function averageHammingDistance(a: string, b: string): number {
  const framesA = a.split(':').filter(Boolean);
  const framesB = b.split(':').filter(Boolean);
  if (framesA.length === 0 || framesB.length === 0) return 64;

  let total = 0;
  let count = 0;
  for (const fa of framesA) {
    for (const fb of framesB) {
      if (fa.length !== 16 || fb.length !== 16) continue;
      total += hammingDistance(fa, fb);
      count++;
    }
  }
  return count === 0 ? 64 : total / count;
}

/**
 * Frame agreement score: fraction of frames in A whose best match in B is within
 * the per-frame threshold. Requires majority agreement, not just one lucky pair.
 *
 * Returns a value in [0, 1]. A score of 1 means every frame in A found a close
 * counterpart in B.
 */
function frameAgreementScore(a: string, b: string, threshold = 10): number {
  const framesA = a.split(':').filter(Boolean);
  const framesB = b.split(':').filter(Boolean);
  let matches = 0;
  let total = 0;

  for (const fa of framesA) {
    let bestForFrame = 64;
    for (const fb of framesB) {
      if (fa.length === 16 && fb.length === 16) {
        bestForFrame = Math.min(bestForFrame, hammingDistance(fa, fb));
      }
    }
    if (bestForFrame <= threshold) matches++;
    total++;
  }
  return total > 0 ? matches / total : 0;
}

/**
 * Positional frame match gate:
 *   - Compare frame i of A against frame i of B (same timestamp position).
 *     Frame 0 of A vs frame 0 of B (0%), frame 1 vs frame 1 (25%), etc.
 *   - A frame pair matches when its Hamming distance ≤ 19 (≥70% of 64 bits agree).
 *   - Videos are considered the same content when at least 2 of the 5 positional
 *     pairs match. This avoids false positives from a single coincidental frame
 *     while remaining robust to encoding variation on a small number of frames.
 */
function isSameContent(hashA: string, hashB: string): boolean {
  const framesA = hashA.split(':').filter(Boolean);
  const framesB = hashB.split(':').filter(Boolean);
  const len = Math.min(framesA.length, framesB.length);
  if (len === 0) return false;

  let matchingFrames = 0;
  for (let i = 0; i < len; i++) {
    if (framesA[i].length !== 16 || framesB[i].length !== 16) continue;
    if (hammingDistance(framesA[i], framesB[i]) <= 19) {
      matchingFrames++;
    }
  }
  return matchingFrames >= 2;
}

/**
 * Group assets by duration windows using a bidirectional sliding window.
 *
 * Returns candidate groups whose durations fall within ±toleranceSec of any
 * member. Re-encoded variants of the same source video sometimes report slightly
 * different durations (e.g. 1080p = 30.00s, 720p = 29.97s); a forward-only window
 * starting at 30.00s would never look back to include 29.5s items, so we expand
 * in both directions from each unvisited seed.
 */
export function groupByDurationWindow(
  assets: AssetWithThumbnail[],
  toleranceSec = 2,
): Set<string>[] {
  if (assets.length === 0) return [];

  const sorted = [...assets]
    .filter((a) => a.duration != null)
    .sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
  if (sorted.length === 0) return [];

  const groups: Set<string>[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    if (visited.has(sorted[i].id)) continue;

    const group = new Set<string>([sorted[i].id]);
    visited.add(sorted[i].id);
    const baseDuration = sorted[i].duration ?? 0;

    // Look backward
    for (let j = i - 1; j >= 0; j--) {
      const diff = Math.abs((sorted[j].duration ?? 0) - baseDuration);
      if (diff > toleranceSec) break;
      if (!visited.has(sorted[j].id)) {
        group.add(sorted[j].id);
        visited.add(sorted[j].id);
      }
    }

    // Look forward
    for (let j = i + 1; j < sorted.length; j++) {
      const diff = Math.abs((sorted[j].duration ?? 0) - baseDuration);
      if (diff > toleranceSec) break;
      if (!visited.has(sorted[j].id)) {
        group.add(sorted[j].id);
        visited.add(sorted[j].id);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Union-Find data structure for clustering.
 */
class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor(items: string[]) {
    this.parent = new Map();
    this.rank = new Map();
    for (const item of items) {
      this.parent.set(item, item);
      this.rank.set(item, 0);
    }
  }

  find(x: string): string {
    const px = this.parent.get(x);
    if (!px || px === x) return x;
    const root = this.find(px);
    this.parent.set(x, root);
    return root;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px === py) return;

    const rx = this.rank.get(px) ?? 0;
    const ry = this.rank.get(py) ?? 0;

    if (rx < ry) {
      this.parent.set(px, py);
    } else if (rx > ry) {
      this.parent.set(py, px);
    } else {
      this.parent.set(py, px);
      this.rank.set(px, rx + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const [item] of this.parent) {
      const root = this.find(item);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(item);
    }
    return clusters;
  }
}

/**
 * Cluster assets by similarity using Union-Find.
 * Only compares assets within the same candidate groups.
 * Returns Map<rootId, assetIds[]> of clusters.
 *
 * Two assets are merged when isSameContent() passes — a three-signal AND gate
 * (average distance, frame agreement, best distance) that is far more precise
 * than the old single-threshold best-distance check.
 */
export function clusterBySimilarity(
  candidateGroups: Set<string>[],
  hashMap: Map<string, string>,
): Map<string, string[]> {
  const allAssetIds = new Set<string>();
  for (const group of candidateGroups) {
    for (const id of group) {
      allAssetIds.add(id);
    }
  }

  if (allAssetIds.size === 0) return new Map();

  const uf = new UnionFind(Array.from(allAssetIds));

  for (const group of candidateGroups) {
    const ids = Array.from(group);

    for (let i = 0; i < ids.length; i++) {
      const hashA = hashMap.get(ids[i]);
      if (!hashA) continue;

      for (let j = i + 1; j < ids.length; j++) {
        const hashB = hashMap.get(ids[j]);
        if (!hashB) continue;

        if (isSameContent(hashA, hashB)) {
          uf.union(ids[i], ids[j]);
        }
      }
    }
  }

  return uf.getClusters();
}

/**
 * Compute or retrieve cached multi-frame video hash for an asset.
 * Hash format: up to 5 ":"-joined 16-char hex frames sampled at 0/25/50/75/100%.
 *
 * If asset.videoHash already contains a multi-frame hash (has ":"), returns it as-is.
 * Single-frame legacy hashes are recomputed (they'll be cleared by the migration anyway).
 */
export async function getOrComputeVideoHash(
  assetId: string,
  thumbnailUrl: string | null,
  durationSec: number | null,
  existingHash: string | null,
): Promise<string | null> {
  // Treat anything with a ":" as already in multi-frame format
  if (existingHash && existingHash.includes(':')) return existingHash;
  if (!thumbnailUrl) return null;

  const hash = await computeMultiFrameHash(thumbnailUrl, durationSec);
  if (!hash) return null;

  await prisma.asset.update({
    where: { id: assetId },
    data: { videoHash: hash },
  });

  return hash;
}

/**
 * Compute or retrieve cached *5-frame* hash tuple for an asset.
 *
 * Frames are sampled at 10/25/50/75/90% of duration, and each frame is a 64-bit
 * (16 hex chars) wavelet pHash. The DB cache is stored in `asset.videoHash` as
 * a ":"-joined string of 5 frames.
 *
 * Returns null if duration/thumbnail is missing, or any frame hash fails.
 */
export async function getOrComputeMultiFrameHashes(
  assetId: string,
  thumbnailUrl: string,
  durationSec: number,
  existingHash: string | null,
  forceRecompute = false,
): Promise<MultiFrameHash | null> {
  if (!forceRecompute) {
    const parsed = existingHash?.split(':').filter(Boolean) ?? [];
    if (parsed.length === 5 && parsed.every((h) => h.length === 16)) {
      return parsed as MultiFrameHash;
    }
  }

  if (!thumbnailUrl) return null;
  if (!Number.isFinite(durationSec)) return null;

  if (durationSec < 1) {
    const single = await computePHash(thumbnailAtTime(thumbnailUrl, 0));
    if (!single || single.length !== 16) return null;
    const tuple: MultiFrameHash = [single, single, single, single, single];
    await prisma.asset.update({
      where: { id: assetId },
      data: { videoHash: tuple.join(':') },
    });
    return tuple;
  }

  const samplePcts = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
  const hashes = await Promise.all(
    samplePcts.map((pct) => computePHash(thumbnailAtTime(thumbnailUrl, durationSec * pct))),
  );

  if (hashes.some((h) => !h || h.length !== 16)) return null;
  const tuple = hashes as MultiFrameHash;

  await prisma.asset.update({
    where: { id: assetId },
    data: { videoHash: tuple.join(':') },
  });

  return tuple;
}
