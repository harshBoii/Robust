import { PutObjectCommand } from '@aws-sdk/client-s3';

import { r2CompanionJpegKey } from '@/lib/meta/r2-thumbnail-url';
import { getR2PublicObjectUrl, r2 } from '@/lib/cloudfare/r2';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch JPEG bytes from a URL (e.g. Cloudflare Stream thumbnail), with short retries while processing. */
export async function fetchImageBytesFromUrl(
  url: string,
  options?: { attempts?: number; delayMs?: number },
): Promise<Uint8Array | null> {
  const attempts = options?.attempts ?? 6;
  const delayMs = options?.delayMs ?? 2000;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) return new Uint8Array(buf);
      } else if (res.status !== 404 && res.status !== 425 && res.status !== 503) {
        console.warn(`[r2-video-thumbnail] fetch ${res.status} for ${url}`);
        return null;
      }
    } catch (err) {
      console.warn('[r2-video-thumbnail] fetch error:', err);
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return null;
}

/**
 * Write a JPEG next to the video key (`…/file.mp4` → `…/file.jpg`) and return its public URL.
 */
export async function uploadVideoThumbnailJpegToR2(input: {
  r2Bucket: string;
  videoR2Key: string;
  imageBytes: Uint8Array;
}): Promise<{ thumbnailR2Key: string; publicUrl: string } | null> {
  const thumbnailR2Key = r2CompanionJpegKey(input.videoR2Key);
  const publicUrl = getR2PublicObjectUrl(thumbnailR2Key);
  if (!publicUrl) {
    console.warn('[r2-video-thumbnail] R2_PUBLIC_BASE_URL is not set; skipping PutObject');
    return null;
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: input.r2Bucket,
      Key: thumbnailR2Key,
      Body: input.imageBytes,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return { thumbnailR2Key, publicUrl };
}

/**
 * Download a frame thumbnail (from Stream) and store it on R2 for Meta `image_url` and UI posters.
 */
export async function syncStreamThumbnailToR2(input: {
  r2Bucket: string;
  videoR2Key: string;
  streamThumbnailUrl: string;
}): Promise<{ thumbnailR2Key: string; publicUrl: string } | null> {
  const imageBytes = await fetchImageBytesFromUrl(input.streamThumbnailUrl);
  if (!imageBytes) {
    console.warn(
      `[r2-video-thumbnail] Could not download Stream thumbnail for ${input.videoR2Key}`,
    );
    return null;
  }

  return uploadVideoThumbnailJpegToR2({
    r2Bucket: input.r2Bucket,
    videoR2Key: input.videoR2Key,
    imageBytes,
  });
}
