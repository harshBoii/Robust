/**
 * Site URL normalization and REST root discovery for customer WordPress installs.
 *
 * Unlike Shopify (where every store is *.myshopify.com), a WordPress site can live on any
 * host, at any path, with the REST API relocated or namespaced differently. So we normalize
 * defensively and then ask the site itself where its REST root is.
 */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

export function allowsInsecureWordPress(): boolean {
  return process.env.WORDPRESS_ALLOW_INSECURE_HTTP?.trim() === 'true';
}

export type NormalizedSiteUrl =
  | { ok: true; siteUrl: string; host: string }
  | { ok: false; error: string };

/**
 * Normalize a user-entered site URL to a bare origin + optional subdirectory path,
 * with no trailing slash. Rejects non-HTTPS and private hosts unless explicitly allowed.
 */
export function normalizeSiteUrl(raw: string): NormalizedSiteUrl {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: false, error: 'Site URL is required' };

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: 'Site URL is not a valid URL' };
  }

  const insecureAllowed = allowsInsecureWordPress();

  if (url.protocol !== 'https:' && !insecureAllowed) {
    return { ok: false, error: 'Site URL must use HTTPS' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Site URL must use HTTP or HTTPS' };
  }

  const host = url.hostname;
  if (!insecureAllowed && PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
    return { ok: false, error: 'Site URL must be a publicly reachable host' };
  }
  if (!host.includes('.') && !insecureAllowed) {
    return { ok: false, error: 'Site URL must include a domain' };
  }

  // Keep any subdirectory (WP installed at /blog), drop query/hash/trailing slash.
  const path = url.pathname.replace(/\/+$/, '');
  const siteUrl = `${url.protocol}//${url.host}${path}`;

  return { ok: true, siteUrl, host };
}

/**
 * Ask the site where its REST API lives. WordPress advertises the root via a
 * `Link: <https://site/wp-json/>; rel="https://api.w.org/"` header on any front-end
 * response, which survives permalink customization and subdirectory installs.
 * Falls back to the conventional `<siteUrl>/wp-json`.
 */
export async function discoverRestBase(
  siteUrl: string,
  opts?: { timeoutMs?: number },
): Promise<string> {
  const fallback = `${siteUrl.replace(/\/+$/, '')}/wp-json`;
  const timeoutMs = opts?.timeoutMs ?? getWordPressTimeoutMs();

  try {
    // HEAD is enough — we only want the Link header. Some hosts reject HEAD, so fall
    // through to the conventional path rather than failing the whole connection.
    const res = await fetch(siteUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });

    const link = res.headers.get('link');
    if (link) {
      const found = parseApiLinkHeader(link);
      if (found) return found.replace(/\/+$/, '');
    }
  } catch {
    // fall through
  }

  return fallback;
}

/** Extract the `rel="https://api.w.org/"` target from a Link header value. */
export function parseApiLinkHeader(header: string): string | null {
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?https:\/\/api\.w\.org\/"?/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function getWordPressTimeoutMs(): number {
  const raw = Number.parseInt(process.env.WORDPRESS_API_TIMEOUT_MS?.trim() ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
}

/** Build a permalink-safe absolute URL for a REST path against a discovered root. */
export function restUrl(restBase: string, path: string, query?: Record<string, string>): string {
  const base = restBase.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  return url.toString();
}
