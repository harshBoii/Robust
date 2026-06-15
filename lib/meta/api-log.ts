import 'server-only';

import { prisma } from '@/lib/prisma';
import { redactMetaGraphUrl } from '@/lib/meta/creative-log';

const META_CREATE_SUFFIXES = ['/campaigns', '/adsets', '/adcreatives', '/ads'] as const;

function parseLoggedParamValue(key: string, value: string): unknown {
  if (
    key === 'targeting' ||
    key === 'object_story_spec' ||
    key === 'creative' ||
    key === 'special_ad_categories' ||
    key === 'promoted_object' ||
    key === 'pacing_type'
  ) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

export function resolveMetaApiOperation(path: string, method: string): string {
  for (const suffix of META_CREATE_SUFFIXES) {
    if (path.endsWith(suffix)) return suffix.slice(1);
  }
  if (path.endsWith('/previews')) return 'previews';
  if (path.includes('/adspixels')) return 'pixels';
  if (path.includes('/campaigns')) return 'campaigns';
  if (path.includes('/adsets')) return 'adsets';
  if (path.includes('/ads')) return 'ads';
  return `${method.toLowerCase()} ${path.split('/').filter(Boolean).slice(-1)[0] ?? 'graph'}`;
}

export function buildMetaApiRequestPayload(
  method: string,
  url: URL,
  searchParams?: Record<string, string>,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'access_token') continue;
      params[k] = parseLoggedParamValue(k, v);
    }
  }
  return {
    method: method.toUpperCase(),
    url: redactMetaGraphUrl(url),
    params,
  };
}

export type PersistMetaApiLogInput = {
  companyId?: string | null;
  method: string;
  path: string;
  requestUrl: URL;
  searchParams?: Record<string, string>;
  responseStatus: number;
  responseBody: unknown;
  success: boolean;
  errorMessage?: string | null;
  durationMs?: number;
};

export async function persistMetaApiLog(input: PersistMetaApiLogInput): Promise<void> {
  const requestPayload = buildMetaApiRequestPayload(input.method, input.requestUrl, input.searchParams);
  const operation = resolveMetaApiOperation(input.path, input.method);

  try {
    await prisma.metaApiLog.create({
      data: {
        companyId: input.companyId ?? null,
        method: input.method.toUpperCase(),
        path: input.path.slice(0, 500),
        requestUrl: redactMetaGraphUrl(input.requestUrl),
        requestPayload: requestPayload as object,
        responseStatus: input.responseStatus,
        responseBody: input.responseBody as object,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
        operation,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('meta_api_logs') || msg.includes('does not exist')) {
      return;
    }
    console.error('[meta api log] persist failed:', msg);
  }
}
