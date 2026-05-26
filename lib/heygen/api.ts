import 'server-only';

const HEYGEN_BASE_URL = 'https://api.heygen.com';

export class HeygenApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'HeygenApiError';
  }
}

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY?.trim();
  if (!key) throw new HeygenApiError('HEYGEN_API_KEY is not configured', 500);
  return key;
}

export async function heygenFetchJson<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${HEYGEN_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': getApiKey(),
      ...init?.headers,
    },
  });

  let body: unknown;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof (body as { message: unknown }).message === 'string'
        ? (body as { message: string }).message
        : `HeyGen API error (${res.status})`;
    throw new HeygenApiError(message, res.status, body);
  }

  return body as T;
}
