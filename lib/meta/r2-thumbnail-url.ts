import { getR2PublicObjectUrl } from '@/lib/cloudfare/r2';

const STREAM_HOST_RE =
  /(?:^|\.)cloudflarestream\.com$|(?:^|\.)videodelivery\.net$/i;

/** True when the URL is a Cloudflare Stream thumbnail/playback host (not usable for Meta `image_url`). */
export function isCloudflareStreamUrl(url: string): boolean {
  try {
    return STREAM_HOST_RE.test(new URL(url.trim()).hostname);
  } catch {
    return false;
  }
}

export function isR2PublicObjectUrl(
  url: string,
  publicBaseUrlOverride?: string | null,
): boolean {
  const trimmed = url.trim();
  const base = (publicBaseUrlOverride ?? process.env.R2_PUBLIC_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!base) return false;
  return trimmed === base || trimmed.startsWith(`${base}/`);
}

/** Sidecar JPEG on the same R2 path as the video, e.g. `uploads/.../file.mp4` → `.../file.jpg`. */
export function r2CompanionJpegKey(videoR2Key: string): string {
  return videoR2Key.replace(/\.[^./]+$/i, '.jpg');
}

/** Thumbnail object under `thumbnails/`, e.g. `thumbnails/file.jpg`. */
export function r2ThumbnailsFolderKey(videoR2Key: string): string {
  const normalized = videoR2Key.replace(/^\/+/, '');
  const basename = normalized.split('/').pop() ?? normalized;
  const stem = basename.replace(/\.[^./]+$/i, '');
  return `thumbnails/${stem}.jpg`;
}

/**
 * Public image URL for Meta `video_data.image_url`.
 * Never returns Cloudflare Stream URLs — only `R2_PUBLIC_BASE_URL` (or override) origins.
 */
export function resolveMetaVideoThumbnailImageUrl(input: {
  r2Key: string;
  thumbnailUrl?: string | null;
  publicBaseUrlOverride?: string | null;
}): string | null {
  const stored = input.thumbnailUrl?.trim();
  if (stored && !isCloudflareStreamUrl(stored) && isR2PublicObjectUrl(stored, input.publicBaseUrlOverride)) {
    return stored;
  }

  for (const key of [r2CompanionJpegKey(input.r2Key), r2ThumbnailsFolderKey(input.r2Key)]) {
    const url = getR2PublicObjectUrl(key, input.publicBaseUrlOverride);
    if (url) return url;
  }

  return null;
}
