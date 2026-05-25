import 'server-only';

import { getAppOrigin } from '@/lib/app-origin';

import type { ProcessFromApiPayload } from './types';

const PROCESS_TIMEOUT_MS = 120_000;

export type ProcessFromApiInput = {
  assetId: string;
  mediaType: 'VIDEO' | 'IMAGE' | 'DOCUMENT';
};

function buildApiUrl(origin: string, assetId: string, mediaType: ProcessFromApiInput['mediaType']): string {
  const base = origin.replace(/\/$/, '');
  if (mediaType === 'VIDEO') {
    return `${base}/api/videos/${assetId}/download`;
  }
  return `${base}/api/assets/${assetId}/download`;
}

function buildPayload(input: ProcessFromApiInput): ProcessFromApiPayload {
  const origin = getAppOrigin();
  const scenePreset = process.env.INTEL_SCENE_PRESET?.trim() || 'sensitive';
  return {
    api_url: buildApiUrl(origin, input.assetId, input.mediaType),
    asset_Id: input.assetId,
    asset_type: input.mediaType,
    scene_preset: scenePreset,
  };
}

function extractJobId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const o = body as Record<string, unknown>;
  if (typeof o.job_id === 'string') return o.job_id;
  if (typeof o.jobId === 'string') return o.jobId;
  if (typeof o.id === 'string') return o.id;
  return null;
}

function getAssetIntelligenceMicroserviceBase(): string {
  const base = process.env.ASSET_INTELLIGENCE_MICROSERVICE_URL?.trim();
  if (!base) {
    throw new Error('ASSET_INTELLIGENCE_MICROSERVICE_URL is not configured');
  }
  return base;
}

export async function callProcessFromApi(input: ProcessFromApiInput): Promise<string> {
  const base = getAssetIntelligenceMicroserviceBase();

  const url = `${base.replace(/\/$/, '')}/process-from-api`;
  const payload = buildPayload(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROCESS_TIMEOUT_MS);

  console.log('[asset-intelligence] POST /process-from-api request', {
    url,
    payload,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Microservice returned invalid JSON (${res.status})`);
    }

    console.log('[asset-intelligence] POST /process-from-api response', {
      status: res.status,
      assetId: input.assetId,
      body,
    });

    if (!res.ok) {
      const errMsg =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `Microservice request failed (${res.status})`;
      throw new Error(errMsg);
    }

    const jobId = extractJobId(body);
    if (!jobId) {
      throw new Error('Microservice response missing job id');
    }
    return jobId;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Microservice request timed out');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callProcessFromApiBatch(
  inputs: ProcessFromApiInput[],
): Promise<string[]> {
  console.log('[asset-intelligence] batch analyze', {
    count: inputs.length,
    assetIds: inputs.map((a) => a.assetId),
  });
  const jobIds: string[] = [];
  for (const input of inputs) {
    jobIds.push(await callProcessFromApi(input));
  }
  console.log('[asset-intelligence] batch complete', { jobIds });
  return jobIds;
}
