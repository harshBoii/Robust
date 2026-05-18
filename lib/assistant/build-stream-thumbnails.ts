/**
 * Build public Cloudflare Stream thumbnail URLs at 3 fixed points in the video.
 * No server-side fetch — URLs are passed directly to the vision LLM.
 */
export function buildStreamThumbnailUrls(streamId: string, durationSec: number): string[] {
  const duration = Math.max(1, Math.floor(durationSec));
  const t1 = Math.max(0, Math.floor(duration / 3));
  const t2 = Math.max(0, Math.floor((2 * duration) / 3));
  const t3 = Math.max(0, duration - 1);

  const base = `https://videodelivery.net/${streamId}/thumbnails/thumbnail.jpg`;
  return [`${base}?time=${t1}s`, `${base}?time=${t2}s`, `${base}?time=${t3}s`];
}
