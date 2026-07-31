/**
 * Typed errors for the WordPress REST client.
 *
 * The message strings are load-bearing: the approve-wordpress route branches on
 * `WP_NOT_CONNECTED` / `WP_UNAUTHORIZED` / `WP_ERROR:<code>` to pick an HTTP status,
 * so `code` and `message` are kept in sync deliberately.
 */
export type WordPressErrorCode =
  | 'WP_NOT_CONNECTED'
  | 'WP_NOT_CONFIGURED'
  | 'WP_UNAUTHORIZED'
  | 'WP_FORBIDDEN'
  | 'WP_NOT_FOUND'
  | 'WP_RATE_LIMITED'
  | 'WP_UNREACHABLE'
  | 'WP_TIMEOUT'
  | 'WP_INVALID_RESPONSE'
  | 'WP_ERROR';

export class WordPressApiError extends Error {
  code: WordPressErrorCode;
  status: number | null;
  /** WordPress's own error slug, e.g. `rest_cannot_create`. */
  wpCode: string | null;
  body: unknown;

  constructor(
    code: WordPressErrorCode,
    opts: { status?: number | null; wpCode?: string | null; body?: unknown; message?: string } = {},
  ) {
    // `WP_ERROR:<slug>` keeps the existing route-level prefix matching working.
    const message =
      opts.message ?? (code === 'WP_ERROR' ? `WP_ERROR:${opts.wpCode ?? 'unknown'}` : code);
    super(message);
    this.name = 'WordPressApiError';
    this.code = code;
    this.status = opts.status ?? null;
    this.wpCode = opts.wpCode ?? null;
    this.body = opts.body;
  }
}

export function isWordPressApiError(e: unknown): e is WordPressApiError {
  return e instanceof WordPressApiError;
}

/** Human-readable message for surfacing in the UI. */
export function wordPressErrorMessage(e: unknown): string {
  if (!isWordPressApiError(e)) {
    return e instanceof Error ? e.message : String(e);
  }
  switch (e.code) {
    case 'WP_NOT_CONNECTED':
      return 'WordPress is not connected for this workspace.';
    case 'WP_NOT_CONFIGURED':
      return 'WordPress publishing is not configured on the server.';
    case 'WP_UNAUTHORIZED':
      return 'WordPress rejected the stored credentials — reconnect the site.';
    case 'WP_FORBIDDEN':
      return 'The connected WordPress user is not allowed to perform this action.';
    case 'WP_NOT_FOUND':
      return 'The WordPress REST endpoint was not found — check that the REST API is enabled.';
    case 'WP_RATE_LIMITED':
      return 'WordPress is rate limiting requests. Try again shortly.';
    case 'WP_TIMEOUT':
      return 'The WordPress site timed out.';
    case 'WP_UNREACHABLE':
      return 'Could not reach the WordPress site.';
    case 'WP_INVALID_RESPONSE':
      return 'The WordPress site returned an unexpected response (is a security plugin blocking the REST API?).';
    default:
      return `WordPress API error${e.wpCode ? ` (${e.wpCode})` : ''}.`;
  }
}
