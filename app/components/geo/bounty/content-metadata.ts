export function parseContentMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

export function metadataString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function metadataStringArray(meta: Record<string, unknown>, key: string): string[] {
  const value = meta[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function extractPostText(body: string, metadata: unknown): string {
  const trimmed = body?.trim() ?? "";
  if (trimmed) return trimmed;

  const meta = parseContentMetadata(metadata);
  const page = meta.page;
  if (page && typeof page === "object" && !Array.isArray(page)) {
    const pageRecord = page as Record<string, unknown>;
    const text = pageRecord.text ?? pageRecord.body ?? pageRecord.content;
    if (typeof text === "string" && text.trim()) return text.trim();
  }

  return "";
}

export function extractHashtags(metadata: unknown): string[] {
  const meta = parseContentMetadata(metadata);
  const fromMeta = metadataStringArray(meta, "hashtags");
  if (fromMeta.length > 0) return fromMeta;

  const page = meta.page;
  if (page && typeof page === "object" && !Array.isArray(page)) {
    return metadataStringArray(page as Record<string, unknown>, "hashtags");
  }
  return [];
}
