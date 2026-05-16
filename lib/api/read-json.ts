import type { MetaErrorPayload } from '@/lib/meta/errors';

export type ApiErrorBody = {
  error?: string;
  metaError?: MetaErrorPayload;
};

export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return {} as T;
  }

  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      res.ok
        ? 'Server returned invalid JSON'
        : `Request failed (${res.status}): ${text.slice(0, 240)}`,
    );
  }

  if (!res.ok) {
    const body = data as ApiErrorBody;
    const message =
      body.metaError?.message?.trim() ||
      body.metaError?.title?.trim() ||
      body.error?.trim() ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
