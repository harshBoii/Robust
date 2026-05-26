import type { Prisma } from '@/app/generated/prisma/client';

export type HeygenJobMetadata = {
  heygen_session_id?: string;
  mode?: string;
  heygen_start_response?: unknown;
  heygen_session_response?: unknown;
  heygen_video_response?: unknown;
  heygen_webhook_payloads?: unknown[];
  [key: string]: unknown;
};

export function parseJobMetadata(metadata: Prisma.JsonValue): HeygenJobMetadata {
  if (typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)) {
    return metadata as HeygenJobMetadata;
  }
  return {};
}

export function mergeJobMetadata(
  existing: Prisma.JsonValue,
  patch: HeygenJobMetadata,
): Prisma.InputJsonValue {
  return { ...parseJobMetadata(existing), ...patch } as Prisma.InputJsonValue;
}

export function getHeygenSessionId(metadata: Prisma.JsonValue): string | null {
  const m = parseJobMetadata(metadata);
  const id = m.heygen_session_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}
