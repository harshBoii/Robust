function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function pickString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function nested(root: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!root) return null;
  return asRecord(root.data) ?? root;
}

export function extractHeygenSessionId(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.session_id,
    root?.sessionId,
    inner?.session_id,
    inner?.sessionId,
    asRecord(inner?.data)?.session_id,
    asRecord(inner?.data)?.sessionId,
  );
}

export function extractHeygenVideoId(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.video_id,
    root?.videoId,
    root?.id,
    inner?.video_id,
    inner?.videoId,
    inner?.id,
    asRecord(inner?.data)?.video_id,
    asRecord(inner?.data)?.video_id,
    asRecord(inner?.data)?.id,
  );
}

export function extractHeygenStatus(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.status,
    root?.video_status,
    root?.state,
    inner?.status,
    inner?.video_status,
    inner?.state,
    asRecord(inner?.data)?.status,
    asRecord(inner?.data)?.video_status,
  );
}

export function extractHeygenDownloadUrl(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.download_url,
    root?.video_url,
    root?.url,
    inner?.download_url,
    inner?.video_url,
    inner?.url,
    asRecord(inner?.data)?.download_url,
    asRecord(inner?.data)?.video_url,
  );
}

export function extractHeygenThumbnailUrl(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.thumbnail_url,
    root?.cover_url,
    inner?.thumbnail_url,
    inner?.cover_url,
    asRecord(inner?.data)?.thumbnail_url,
  );
}

export function extractHeygenCallbackId(payload: unknown): string | null {
  const root = asRecord(payload);
  const inner = nested(root);
  return pickString(
    root?.callback_id,
    root?.callbackId,
    inner?.callback_id,
    inner?.callbackId,
    asRecord(inner?.data)?.callback_id,
  );
}

export function isHeygenTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === 'completed' ||
    s === 'complete' ||
    s === 'ready' ||
    s === 'success' ||
    s === 'succeeded' ||
    s === 'done'
  );
}

export function isHeygenFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'failed' || s === 'error' || s === 'cancelled' || s === 'canceled';
}
