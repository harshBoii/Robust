import 'server-only';

import { microserviceSeedResponseSchema, type MicroserviceSeedResponse } from '@/lib/data-mine/types';

const SEED_TIMEOUT_MS = 120_000;

export type SeedMicroserviceInput = {
  websiteUrl: string;
  linkedinUrl?: string;
  sessionId: string;
};

export async function callCompanySeedMicroservice(
  input: SeedMicroserviceInput,
): Promise<MicroserviceSeedResponse> {
  const base = process.env.MICROSERVICE_URL?.trim();
  if (!base) {
    throw new Error('MICROSERVICE_URL is not configured');
  }

  const url = `${base.replace(/\/$/, '')}/company/seed`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEED_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        website_url: input.websiteUrl,
        ...(input.linkedinUrl ? { linkedin_url: input.linkedinUrl } : {}),
        session_id: input.sessionId,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Microservice returned invalid JSON (${res.status})`);
    }

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

    const parsed = microserviceSeedResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error('Microservice response shape is invalid');
    }
    return parsed.data;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Microservice request timed out');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
