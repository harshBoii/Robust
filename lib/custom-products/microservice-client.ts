import 'server-only';

import {
  microserviceCustomProductResponseSchema,
  type MicroserviceCustomProductResponse,
} from '@/lib/custom-products/microservice-types';

const EXTRACT_TIMEOUT_MS = 120_000;

export type CustomProductMicroserviceInput = {
  companyId: string;
  sessionId: string;
  companyDomain?: string;
  imageBase64?: string;
  imageMimeType?: string;
  pdfBase64?: string;
};

function parseMicroserviceError(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null) {
    if ('detail' in body && typeof (body as { detail: unknown }).detail === 'string') {
      return (body as { detail: string }).detail;
    }
    if ('error' in body && typeof (body as { error: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
  }
  return `Microservice request failed (${status})`;
}

export async function callCustomProductMicroservice(
  input: CustomProductMicroserviceInput,
): Promise<MicroserviceCustomProductResponse> {
  const base = process.env.MICROSERVICE_URL?.trim();
  if (!base) {
    throw new Error('MICROSERVICE_URL is not configured');
  }

  const url = `${base.replace(/\/$/, '')}/company/custom-product`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);

  const payload: Record<string, string> = {
    companyId: input.companyId,
    session_id: input.sessionId,
  };
  if (input.companyDomain) payload.companyDomain = input.companyDomain;
  if (input.imageBase64) {
    payload.imageBase64 = input.imageBase64;
    if (input.imageMimeType) payload.imageMimeType = input.imageMimeType;
  }
  if (input.pdfBase64) payload.pdfBase64 = input.pdfBase64;

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

    if (!res.ok) {
      throw new Error(parseMicroserviceError(body, res.status));
    }

    const parsed = microserviceCustomProductResponseSchema.safeParse(body);
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
