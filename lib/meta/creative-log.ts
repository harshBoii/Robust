import 'server-only';

const PREFIX = '[meta-creative]';

export function isMetaCreativeLogEnabled(): boolean {
  if (process.env.META_CREATIVE_LOG === '0') return false;
  if (process.env.META_CREATIVE_LOG === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('access_token')) {
      u.searchParams.set('access_token', '[REDACTED]');
    }
    return u.toString();
  } catch {
    return url.replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]');
  }
}

function redactMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.slice(0, 80)}${u.pathname.length > 80 ? '…' : ''}`;
  } catch {
    return '[invalid-url]';
  }
}

export function logMetaCreativeProgress(
  phase: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!isMetaCreativeLogEnabled()) return;
  const payload = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${PREFIX} [progress] ${phase}: ${message}${payload}`);
}

export function logMetaCreativeRequest(
  operation: string,
  input: {
    method: string;
    path: string;
    url?: string;
    searchParams?: Record<string, string>;
    metaAdId?: string;
    companyId?: string;
  },
): void {
  if (!isMetaCreativeLogEnabled()) return;
  console.log(
    `${PREFIX} [request] ${operation}\n${JSON.stringify(
      {
        method: input.method,
        path: input.path,
        url: input.url,
        metaAdId: input.metaAdId,
        companyId: input.companyId,
        searchParams: input.searchParams,
      },
      null,
      2,
    )}`,
  );
}

export function logMetaCreativeResponse(
  operation: string,
  input: {
    status: number;
    durationMs: number;
    body: unknown;
    error?: string;
  },
): void {
  if (!isMetaCreativeLogEnabled()) return;
  console.log(
    `${PREFIX} [response] ${operation}\n${JSON.stringify(
      {
        status: input.status,
        durationMs: input.durationMs,
        error: input.error,
        body: summarizeResponseBody(operation, input.body),
      },
      null,
      2,
    )}`,
  );
}

function summarizeResponseBody(operation: string, body: unknown): unknown {
  if (body == null) return body;
  if (typeof body !== 'object') return body;

  const o = body as Record<string, unknown>;

  if (operation === 'ad_creative_details') {
    const creative = o.creative as Record<string, unknown> | undefined;
    let spec = creative?.object_story_spec;
    if (typeof spec === 'string') {
      try {
        spec = JSON.parse(spec) as unknown;
      } catch {
        spec = '[unparsed string]';
      }
    }
    return {
      id: o.id,
      name: o.name,
      creative: creative
        ? {
            id: creative.id,
            thumbnail_url: redactMediaUrl(
              typeof creative.thumbnail_url === 'string'
                ? creative.thumbnail_url
                : null,
            ),
            object_story_spec: spec,
          }
        : null,
    };
  }

  if (operation === 'adimages') {
    const data = Array.isArray(o.data) ? o.data : [];
    return {
      data: data.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          hash: r.hash,
          url: redactMediaUrl(typeof r.url === 'string' ? r.url : null),
          permalink_url: redactMediaUrl(
            typeof r.permalink_url === 'string' ? r.permalink_url : null,
          ),
        };
      }),
      error: o.error,
    };
  }

  if (operation === 'video_source') {
    return {
      source: redactMediaUrl(typeof o.source === 'string' ? o.source : null),
      title: o.title,
      error: o.error,
    };
  }

  if (operation === 'creative_by_id') {
    return {
      id: o.id,
      thumbnail_url: redactMediaUrl(
        typeof o.thumbnail_url === 'string' ? o.thumbnail_url : null,
      ),
      image_url: redactMediaUrl(
        typeof o.image_url === 'string' ? o.image_url : null,
      ),
      video_id: o.video_id,
      has_object_story_spec: Boolean(o.object_story_spec),
      has_asset_feed_spec: Boolean(o.asset_feed_spec),
    };
  }

  return o;
}

export function logMetaCreativeDownload(input: {
  metaAdId: string;
  kind: 'image' | 'video';
  status: number;
  bytes: number;
  mimeType: string;
  durationMs: number;
  urlHost: string;
}): void {
  if (!isMetaCreativeLogEnabled()) return;
  console.log(
    `${PREFIX} [download] ${input.kind} for ad ${input.metaAdId}\n${JSON.stringify(
      {
        status: input.status,
        bytes: input.bytes,
        mimeType: input.mimeType,
        durationMs: input.durationMs,
        urlHost: input.urlHost,
      },
      null,
      2,
    )}`,
  );
}

export function redactMetaGraphUrl(url: URL): string {
  return redactUrl(url.toString());
}
