import 'server-only';

import { getWordPressTimeoutMs, restUrl } from '@/lib/wordpress/domain';
import { WordPressApiError } from '@/lib/wordpress/errors';
import type { WordPressContext } from '@/lib/wordpress/config';

/**
 * WordPress REST client.
 *
 * Auth is HTTP Basic with a WP core Application Password. WP only honours Basic auth for
 * application passwords over HTTPS, which `normalizeSiteUrl` already enforces.
 */

export type WpFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  /** Namespace under the REST root. Defaults to `wp/v2`. */
  namespace?: string;
  timeoutMs?: number;
  /** Retry once on 5xx / network failure. Default true for reads, false for writes. */
  retry?: boolean;
};

type WpErrorBody = {
  code?: string;
  message?: string;
  data?: { status?: number };
};

function buildAuthHeader(ctx: Pick<WordPressContext, 'username' | 'appPassword'>): string {
  // WP shows application passwords with spaces for readability; they are not part of
  // the credential and must be stripped before encoding.
  const password = ctx.appPassword.replace(/\s+/g, '');
  const token = Buffer.from(`${ctx.username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function mapStatusToError(status: number, body: unknown): WordPressApiError {
  const wpBody = (body ?? {}) as WpErrorBody;
  const wpCode = typeof wpBody.code === 'string' ? wpBody.code : null;

  if (status === 401) {
    return new WordPressApiError('WP_UNAUTHORIZED', { status, wpCode, body });
  }
  if (status === 403) {
    // WP returns 403 with `rest_cannot_*` for capability failures, but also for
    // nonce/cookie confusion. Both mean "this user cannot do this".
    return new WordPressApiError('WP_FORBIDDEN', { status, wpCode, body });
  }
  if (status === 404) {
    return new WordPressApiError('WP_NOT_FOUND', { status, wpCode, body });
  }
  if (status === 429) {
    return new WordPressApiError('WP_RATE_LIMITED', { status, wpCode, body });
  }
  return new WordPressApiError('WP_ERROR', { status, wpCode, body });
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A security plugin or WAF returning an HTML challenge page is the common case here.
    return { __raw: text.slice(0, 500) };
  }
}

/**
 * Perform an authenticated WordPress REST call.
 *
 * Throws `WordPressApiError` with a typed `code` for every failure mode so callers and
 * route handlers can branch without string-sniffing.
 */
export async function wpFetch<T = unknown>(
  ctx: WordPressContext,
  opts: WpFetchOptions,
): Promise<T> {
  const method = opts.method ?? 'GET';
  const namespace = opts.namespace ?? 'wp/v2';
  const timeoutMs = opts.timeoutMs ?? getWordPressTimeoutMs();
  const retry = opts.retry ?? method === 'GET';

  const path = `/${namespace.replace(/^\/|\/$/g, '')}${
    opts.path.startsWith('/') ? opts.path : `/${opts.path}`
  }`;
  const url = restUrl(ctx.restBase, path, opts.query);

  const attempt = async (): Promise<{ res: Response; body: unknown }> => {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: buildAuthHeader(ctx),
        Accept: 'application/json',
        ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      redirect: 'follow',
    });
    return { res, body: await readBody(res) };
  };

  let result: { res: Response; body: unknown };
  try {
    result = await attempt();
    if (retry && isRetryableStatus(result.res.status)) {
      result = await attempt();
    }
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new WordPressApiError('WP_TIMEOUT', { message: 'WP_TIMEOUT' });
    }
    if (retry) {
      try {
        result = await attempt();
      } catch {
        throw new WordPressApiError('WP_UNREACHABLE', {
          message: e instanceof Error ? `WP_UNREACHABLE:${e.message}` : 'WP_UNREACHABLE',
        });
      }
    } else {
      throw new WordPressApiError('WP_UNREACHABLE', {
        message: e instanceof Error ? `WP_UNREACHABLE:${e.message}` : 'WP_UNREACHABLE',
      });
    }
  }

  const { res, body } = result;

  if (!res.ok) {
    throw mapStatusToError(res.status, body);
  }

  // A 200 that isn't JSON means something intercepted the REST API.
  if (body !== null && typeof body === 'object' && '__raw' in body) {
    throw new WordPressApiError('WP_INVALID_RESPONSE', { status: res.status, body });
  }

  return body as T;
}

/**
 * Unauthenticated probe of the REST root. Used during connect, before we hold any
 * credentials, to confirm the site actually speaks WordPress REST.
 */
export async function wpProbeRoot(
  restBase: string,
  opts?: { timeoutMs?: number },
): Promise<{ name?: string; description?: string; namespaces?: string[]; url?: string }> {
  const timeoutMs = opts?.timeoutMs ?? getWordPressTimeoutMs();
  let res: Response;
  try {
    res = await fetch(restBase, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
      redirect: 'follow',
    });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new WordPressApiError('WP_TIMEOUT');
    }
    throw new WordPressApiError('WP_UNREACHABLE');
  }

  const body = await readBody(res);
  if (!res.ok) throw mapStatusToError(res.status, body);
  if (body === null || typeof body !== 'object' || '__raw' in body) {
    throw new WordPressApiError('WP_INVALID_RESPONSE', { status: res.status, body });
  }
  return body as { name?: string; namespaces?: string[] };
}
