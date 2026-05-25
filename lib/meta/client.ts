import 'server-only';

import { toMetaPacingTypeParam } from '@/lib/meta/adset-preset-meta';
import {
  logMetaCreativeProgress,
  logMetaCreativeRequest,
  logMetaCreativeResponse,
  redactMetaGraphUrl,
} from '@/lib/meta/creative-log';
import { metaErrorFromGraph } from '@/lib/meta/errors';
import { resolveMetaGraphAccessToken } from '@/lib/meta/integration-token';

type MetaGraphResponse<T> = {
  data?: T;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type MetaAdStatus = 'ACTIVE' | 'PAUSED';
export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type MetaAdSetStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export type MetaAdInsightRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  // Meta Marketing API v21+ exposes 2-sec continuous watch actions (3-sec field is not available).
  video_continuous_2_sec_watched_actions?: Array<{
    action_type?: string;
    value?: string;
  }>;
};

export type MetaCreative = {
  id?: string;
  thumbnail_url?: string;
};

export type MetaCampaignData = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
};

export type MetaAdSetData = {
  id: string;
  name?: string;
  status?: string;
  daily_budget?: string;
};

export type MetaAdRow = {
  id: string;
  name?: string;
  status?: MetaAdStatus;
  campaign_id?: string;
  adset_id?: string;
  created_time?: string;
  creative?: MetaCreative;
  insights?: { data?: MetaAdInsightRow[] };
  campaign?: MetaCampaignData;
  adset?: MetaAdSetData;
};

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

const META_CREATE_LOG_PATHS = ['/campaigns', '/adsets', '/adcreatives'] as const;

function redactMetaUrl(url: URL): string {
  const copy = new URL(url);
  if (copy.searchParams.has('access_token')) {
    copy.searchParams.set('access_token', '[REDACTED]');
  }
  return copy.toString();
}

function metaCreateLogLabel(path: string): string | null {
  for (const suffix of META_CREATE_LOG_PATHS) {
    if (path.endsWith(suffix)) {
      return suffix.slice(1);
    }
  }
  return null;
}

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

function buildMetaCreateLogPayload(
  url: URL,
  params?: Record<string, string>,
): Record<string, unknown> {
  const body = params
    ? Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, parseLoggedParamValue(k, v)]),
      )
    : {};
  return {
    method: 'POST',
    url: redactMetaUrl(url),
    body,
  };
}

function logMetaCreateRequest(label: string, url: URL, params?: Record<string, string>) {
  const payload = buildMetaCreateLogPayload(url, params);
  console.log(`[meta api] create ${label} request\n${JSON.stringify(payload, null, 2)}`);
}

function logMetaCreateResponse(label: string, status: number, body: unknown) {
  console.log(
    `[meta api] create ${label} response\n${JSON.stringify({ status, body }, null, 2)}`,
  );
}

function requireSystemAccessToken() {
  const token = process.env.META_SYSTEM_ACCESS_TOKEN;
  if (!token) {
    throw new Error('TOKEN is not set');
  }
  return token;
}

/** Pass `companyId` to prefer the workspace OAuth token over the system token. */
export type MetaGraphAuth = {
  companyId?: string;
  accessToken?: string;
};

async function resolveMetaFetchToken(auth?: MetaGraphAuth): Promise<string> {
  if (auth?.accessToken) return auth.accessToken;
  if (auth?.companyId) return resolveMetaGraphAccessToken(auth.companyId);
  return requireSystemAccessToken();
}

type MetaFetchInit = RequestInit &
  MetaGraphAuth & {
    searchParams?: Record<string, string>;
    /** Log request/response under [meta-creative] (asset intelligence import). */
    creativeLog?: {
      operation: string;
      metaAdId?: string;
    };
  };

async function metaFetch<T>(path: string, init?: MetaFetchInit): Promise<T> {
  const { searchParams, companyId, accessToken, creativeLog, ...fetchInit } =
    init ?? {};
  const token = await resolveMetaFetchToken({ companyId, accessToken });
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', token);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const method = (fetchInit.method ?? 'GET').toUpperCase();
  const createLabel = method === 'POST' ? metaCreateLogLabel(path) : null;
  if (createLabel) {
    logMetaCreateRequest(createLabel, url, searchParams);
  }

  const started = Date.now();
  if (creativeLog) {
    logMetaCreativeRequest(creativeLog.operation, {
      method,
      path,
      url: redactMetaGraphUrl(url),
      searchParams,
      metaAdId: creativeLog.metaAdId,
      companyId,
    });
  }

  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      ...(fetchInit.headers ?? {}),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = (await res.json()) as MetaGraphResponse<T>;

  if (creativeLog) {
    logMetaCreativeResponse(creativeLog.operation, {
      status: res.status,
      durationMs: Date.now() - started,
      body: json,
      error: json.error?.message,
    });
  }

  if (createLabel) {
    logMetaCreateResponse(createLabel, res.status, json);
  }
  if (!res.ok || json.error) {
    throw metaErrorFromGraph(json.error, res.status);
  }
  return json as unknown as T;
}

function assertOk<T>(res: T): T {
  if (res == null) throw new Error('Meta API error');
  return res;
}

export type MetaCreativePreviewRow = {
  body?: string;
  // Some preview responses may include additional fields; keep it loose.
  [key: string]: unknown;
};

export async function getAdCreativePreviews(
  input: {
    creativeId: string;
    adFormat?: string;
  } & MetaGraphAuth,
): Promise<MetaCreativePreviewRow[]> {
  const { creativeId, adFormat, companyId, accessToken } = input;
  const resp = await metaFetch<{ data?: MetaCreativePreviewRow[] }>(`/${creativeId}/previews`, {
    method: 'GET',
    companyId,
    accessToken,
    searchParams: {
      ad_format: adFormat ?? 'DESKTOP_FEED_STANDARD',
    },
  });
  return resp.data ?? [];
}

export async function getAdsWithInsights(
  input: {
    adAccountId: string;
    datePreset: 'today' | 'maximum' | 'last_7d' | 'last_30d';
    timeIncrement?: number;
    timeRange?: { since: string; until: string };
  } & MetaGraphAuth,
): Promise<MetaAdRow[]> {
  const { adAccountId, datePreset, timeIncrement, timeRange } = input;

  const insightsParts: string[] = [
    `date_preset(${datePreset})`,
    'fields(spend,impressions,clicks,ctr,actions,video_continuous_2_sec_watched_actions)',
  ];
  if (typeof timeIncrement === 'number') {
    insightsParts.push(`time_increment(${timeIncrement})`);
  }
  if (timeRange) {
    // Must be JSON string for Graph API
    insightsParts.push(`time_range(${JSON.stringify(timeRange)})`);
  }

  const fields = [
    'id',
    'name',
    'status',
    'campaign_id',
    'adset_id',
    'created_time',
    'creative{id,thumbnail_url}',
    'campaign{id,name,objective,status,daily_budget}',
    'adset{id,name,status,daily_budget}',
    `insights.${insightsParts.join('.')}`,
  ].join(',');

  const resp = await metaFetch<{ data: MetaAdRow[] }>(`/${adAccountId}/ads`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      fields,
      limit: '100',
    },
  });

  return resp.data ?? [];
}

export async function updateAdStatus(
  input: {
    adId: string;
    status: MetaAdStatus;
  } & MetaGraphAuth,
): Promise<void> {
  const { adId, status, companyId, accessToken } = input;
  await metaFetch<Record<string, unknown>>(`/${adId}`, {
    method: 'POST',
    companyId,
    accessToken,
    searchParams: {
      status,
    },
  });
}

export type MetaAdCreativeDetails = {
  metaAdId: string;
  adName: string | null;
  metaCreativeId: string | null;
  imageHash: string | null;
  videoId: string | null;
  /** Direct image URL from creative node (non-hash ads). */
  imageUrl: string | null;
  thumbnailUrl: string | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  ctaType: string | null;
  landingUrl: string | null;
  /** catalog / dynamic product (template_data) */
  isCatalogCreative: boolean;
};

type ParsedCreativeFields = {
  imageHash: string | null;
  videoId: string | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  ctaType: string | null;
  landingUrl: string | null;
  isCatalogCreative: boolean;
};

function emptyParsedFields(): ParsedCreativeFields {
  return {
    imageHash: null,
    videoId: null,
    headline: null,
    primaryText: null,
    description: null,
    ctaType: null,
    landingUrl: null,
    isCatalogCreative: false,
  };
}

function ctaFromBlock(block: Record<string, unknown> | undefined): string | null {
  const cta = block?.call_to_action as Record<string, unknown> | undefined;
  return typeof cta?.type === 'string' ? cta.type : null;
}

function parseAssetFeedSpec(spec: unknown): Pick<
  ParsedCreativeFields,
  'imageHash' | 'videoId'
> {
  if (!spec || typeof spec !== 'object') {
    return { imageHash: null, videoId: null };
  }
  const o = spec as Record<string, unknown>;
  const images = Array.isArray(o.images) ? o.images : [];
  const videos = Array.isArray(o.videos) ? o.videos : [];
  const firstImg = images[0] as Record<string, unknown> | undefined;
  const firstVid = videos[0] as Record<string, unknown> | undefined;
  return {
    imageHash:
      typeof firstImg?.hash === 'string'
        ? firstImg.hash
        : typeof o.image_hash === 'string'
          ? o.image_hash
          : null,
    videoId:
      typeof firstVid?.video_id === 'string'
        ? firstVid.video_id
        : typeof o.video_id === 'string'
          ? o.video_id
          : null,
  };
}

function mergeParsedFields(
  base: ParsedCreativeFields,
  extra: Partial<ParsedCreativeFields>,
): ParsedCreativeFields {
  return {
    imageHash: extra.imageHash ?? base.imageHash,
    videoId: extra.videoId ?? base.videoId,
    headline: extra.headline ?? base.headline,
    primaryText: extra.primaryText ?? base.primaryText,
    description: extra.description ?? base.description,
    ctaType: extra.ctaType ?? base.ctaType,
    landingUrl: extra.landingUrl ?? base.landingUrl,
    isCatalogCreative: extra.isCatalogCreative ?? base.isCatalogCreative,
  };
}

function parseObjectStorySpec(spec: unknown): ParsedCreativeFields {
  const empty = emptyParsedFields();
  if (!spec || typeof spec !== 'object') return empty;
  const o = spec as Record<string, unknown>;
  const linkData = o.link_data as Record<string, unknown> | undefined;
  const videoData = o.video_data as Record<string, unknown> | undefined;
  const templateData = o.template_data as Record<string, unknown> | undefined;
  const assetFeed = parseAssetFeedSpec(o.asset_feed_spec);

  if (linkData && typeof linkData === 'object') {
    return mergeParsedFields(empty, {
      ...assetFeed,
      imageHash:
        typeof linkData.image_hash === 'string' ? linkData.image_hash : null,
      headline: typeof linkData.name === 'string' ? linkData.name : null,
      primaryText: typeof linkData.message === 'string' ? linkData.message : null,
      description:
        typeof linkData.description === 'string' ? linkData.description : null,
      ctaType: ctaFromBlock(linkData),
      landingUrl: typeof linkData.link === 'string' ? linkData.link : null,
    });
  }

  if (videoData && typeof videoData === 'object') {
    return mergeParsedFields(empty, {
      ...assetFeed,
      videoId: typeof videoData.video_id === 'string' ? videoData.video_id : null,
      headline: typeof videoData.title === 'string' ? videoData.title : null,
      primaryText: typeof videoData.message === 'string' ? videoData.message : null,
      ctaType: ctaFromBlock(videoData),
      landingUrl: typeof videoData.link === 'string' ? videoData.link : null,
    });
  }

  if (templateData && typeof templateData === 'object') {
    return mergeParsedFields(empty, {
      headline: typeof templateData.name === 'string' ? templateData.name : null,
      primaryText:
        typeof templateData.message === 'string' ? templateData.message : null,
      ctaType: ctaFromBlock(templateData),
      landingUrl: typeof templateData.link === 'string' ? templateData.link : null,
      isCatalogCreative: true,
      ...assetFeed,
    });
  }

  if (assetFeed.imageHash || assetFeed.videoId) {
    return mergeParsedFields(empty, assetFeed);
  }

  return empty;
}

function normalizeObjectStorySpec(spec: unknown): unknown {
  if (typeof spec === 'string') {
    try {
      return JSON.parse(spec) as unknown;
    } catch {
      return undefined;
    }
  }
  return spec;
}

/** Fetch AdCreative node when ad-level payload lacks image_hash / video_id. */
async function fetchMetaCreativeNodeDetails(
  input: { metaCreativeId: string; metaAdId: string } & MetaGraphAuth,
): Promise<{
  imageHash: string | null;
  videoId: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  headline: string | null;
  primaryText: string | null;
  description: string | null;
  ctaType: string | null;
  landingUrl: string | null;
  isCatalogCreative: boolean;
}> {
  const fields = [
    'id',
    'thumbnail_url',
    'image_url',
    'video_id',
    'object_story_spec',
    'asset_feed_spec',
  ].join(',');

  const row = await metaFetch<{
    id?: string;
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    object_story_spec?: unknown;
    asset_feed_spec?: unknown;
  }>(`/${input.metaCreativeId}`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: { fields },
    creativeLog: {
      operation: 'creative_by_id',
      metaAdId: input.metaAdId,
    },
  });

  const spec = normalizeObjectStorySpec(row.object_story_spec);
  const parsed = mergeParsedFields(
    parseObjectStorySpec(spec),
    parseAssetFeedSpec(row.asset_feed_spec),
  );

  return {
    imageHash: parsed.imageHash,
    videoId:
      parsed.videoId ??
      (typeof row.video_id === 'string' ? row.video_id : null),
    imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
    thumbnailUrl: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : null,
    headline: parsed.headline,
    primaryText: parsed.primaryText,
    description: parsed.description,
    ctaType: parsed.ctaType,
    landingUrl: parsed.landingUrl,
    isCatalogCreative: parsed.isCatalogCreative,
  };
}

function hasResolvableMedia(d: MetaAdCreativeDetails): boolean {
  return Boolean(
    d.imageHash || d.videoId || d.imageUrl || d.thumbnailUrl,
  );
}

/** Live Meta fields for linking gallery assets to ads via image_hash / video_id. */
export async function getMetaAdCreativeDetails(
  input: { metaAdId: string } & MetaGraphAuth,
): Promise<MetaAdCreativeDetails> {
  const fields = [
    'name',
    'creative{id,thumbnail_url,object_story_spec}',
  ].join(',');

  const row = await metaFetch<{
    id?: string;
    name?: string;
    creative?: {
      id?: string;
      thumbnail_url?: string;
      object_story_spec?: unknown;
    };
  }>(`/${input.metaAdId}`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: { fields },
    creativeLog: {
      operation: 'ad_creative_details',
      metaAdId: input.metaAdId,
    },
  });

  const spec = normalizeObjectStorySpec(row.creative?.object_story_spec);
  const parsed = parseObjectStorySpec(spec);

  let details: MetaAdCreativeDetails = {
    metaAdId: input.metaAdId,
    adName: row.name ?? null,
    metaCreativeId: row.creative?.id ?? null,
    imageUrl: null,
    thumbnailUrl: row.creative?.thumbnail_url ?? null,
    ...parsed,
  };

  if (!hasResolvableMedia(details) && details.metaCreativeId) {
    const node = await fetchMetaCreativeNodeDetails({
      companyId: input.companyId,
      accessToken: input.accessToken,
      metaCreativeId: details.metaCreativeId,
      metaAdId: input.metaAdId,
    });
    details = {
      ...details,
      imageHash: details.imageHash ?? node.imageHash,
      videoId: details.videoId ?? node.videoId,
      imageUrl: node.imageUrl ?? details.imageUrl,
      thumbnailUrl: node.thumbnailUrl ?? details.thumbnailUrl,
      headline: details.headline ?? node.headline,
      primaryText: details.primaryText ?? node.primaryText,
      description: details.description ?? node.description,
      ctaType: details.ctaType ?? node.ctaType,
      landingUrl: details.landingUrl ?? node.landingUrl,
      isCatalogCreative: details.isCatalogCreative || node.isCatalogCreative,
    };
  }

  logMetaCreativeProgress('ad_creative_details', 'parsed', {
    metaAdId: details.metaAdId,
    metaCreativeId: details.metaCreativeId,
    imageHash: details.imageHash,
    videoId: details.videoId,
    imageUrl: Boolean(details.imageUrl),
    thumbnailUrl: Boolean(details.thumbnailUrl),
    isCatalogCreative: details.isCatalogCreative,
    hasHeadline: Boolean(details.headline),
  });

  return details;
}

/** Resolve downloadable image URL for an ad account image hash. */
export async function getMetaAdImageDownloadUrl(
  input: { adAccountId: string; imageHash: string } & MetaGraphAuth,
): Promise<string> {
  const hashesParam = JSON.stringify([input.imageHash]);
  const resp = await metaFetch<{
    data?: Array<{ hash?: string; url?: string; permalink_url?: string }>;
  }>(`/${input.adAccountId}/adimages`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      hashes: hashesParam,
      fields: 'hash,url,permalink_url',
    },
    creativeLog: {
      operation: 'adimages',
      metaAdId: input.imageHash,
    },
  });

  const row =
    resp.data?.find((r) => r.hash === input.imageHash) ?? resp.data?.[0];
  const url = row?.url ?? row?.permalink_url;
  if (!url) {
    throw new Error('Meta did not return a download URL for this image hash');
  }
  return url;
}

/** Resolve temporary video source URL from Meta video id. */
export async function getMetaVideoSourceUrl(
  input: { videoId: string } & MetaGraphAuth,
): Promise<string> {
  const resp = await metaFetch<{ source?: string }>(`/${input.videoId}`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: { fields: 'source' },
    creativeLog: {
      operation: 'video_source',
      metaAdId: input.videoId,
    },
  });
  if (!resp.source?.trim()) {
    throw new Error('Meta did not return a video source URL');
  }
  return resp.source.trim();
}

export type MetaAdAccount = { id: string; name?: string };
export type MetaPage = { id: string; name?: string };

export async function getMyAdAccounts(opts?: MetaGraphAuth): Promise<MetaAdAccount[]> {
  const resp = await metaFetch<{ data: MetaAdAccount[] }>('/me/adaccounts', {
    method: 'GET',
    companyId: opts?.companyId,
    accessToken: opts?.accessToken,
    searchParams: {
      fields: 'id,name',
      limit: '200',
    },
  });
  return resp.data ?? [];
}

export async function getMyPages(opts?: MetaGraphAuth): Promise<MetaPage[]> {
  const resp = await metaFetch<{ data: MetaPage[] }>('/me/accounts', {
    method: 'GET',
    companyId: opts?.companyId,
    accessToken: opts?.accessToken,
    searchParams: {
      fields: 'id,name',
      limit: '200',
    },
  });
  return resp.data ?? [];
}

/** Instagram business account linked to a Facebook page. */
export async function getPageInstagramUsername(
  pageId: string,
  opts?: MetaGraphAuth,
): Promise<string | null> {
  try {
    const resp = await metaFetch<{
      connected_instagram_account?: { username?: string };
    }>(`/${pageId}`, {
      method: 'GET',
      companyId: opts?.companyId,
      accessToken: opts?.accessToken,
      searchParams: {
        fields: 'connected_instagram_account{username}',
      },
    });
    const username = resp.connected_instagram_account?.username?.trim();
    return username ? `@${username.replace(/^@/, '')}` : null;
  } catch {
    return null;
  }
}

export type MetaAdPixel = {
  id: string;
  name?: string;
  is_unavailable?: boolean;
};

/** Pixels owned by or shared with the ad account. */
export async function getAdAccountPixels(
  adAccountId: string,
  auth?: MetaGraphAuth,
): Promise<MetaAdPixel[]> {
  const resp = await metaFetch<{ data: MetaAdPixel[] }>(`/${adAccountId}/adspixels`, {
    method: 'GET',
    companyId: auth?.companyId,
    accessToken: auth?.accessToken,
    searchParams: {
      fields: 'id,name,is_unavailable',
      limit: '50',
    },
  });
  const rows = resp.data ?? [];
  return rows.filter((p) => p.id);
}

export type MetaCampaignRow = {
  id: string;
  name?: string;
  objective?: string;
  status?: MetaCampaignStatus | string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  spend_cap?: string;
  special_ad_categories?: string[];
  created_time?: string;
};

export async function getCampaignsForAccount(
  input: { adAccountId: string } & MetaGraphAuth,
): Promise<MetaCampaignRow[]> {
  const resp = await metaFetch<{ data: MetaCampaignRow[] }>(`/${input.adAccountId}/campaigns`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      fields: [
        'id',
        'name',
        'objective',
        'status',
        'daily_budget',
        'lifetime_budget',
        'bid_strategy',
        'spend_cap',
        'special_ad_categories',
        'created_time',
      ].join(','),
      limit: '200',
    },
  });
  return resp.data ?? [];
}

export type MetaAdSetRow = {
  id: string;
  name?: string;
  status?: MetaAdSetStatus | string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  bid_amount?: string;
  optimization_goal?: string;
  billing_event?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
  created_time?: string;
};

export async function getAdSetsForCampaign(
  input: { metaCampaignId: string } & MetaGraphAuth,
): Promise<MetaAdSetRow[]> {
  const resp = await metaFetch<{ data: MetaAdSetRow[] }>(`/${input.metaCampaignId}/adsets`, {
    method: 'GET',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      fields: [
        'id',
        'name',
        'status',
        'daily_budget',
        'lifetime_budget',
        'bid_strategy',
        'bid_amount',
        'optimization_goal',
        'billing_event',
        'targeting',
        'start_time',
        'end_time',
        'created_time',
      ].join(','),
      limit: '200',
    },
  });
  return resp.data ?? [];
}

export async function createCampaign(
  input: {
    adAccountId: string;
    name: string;
    objective: string;
    status?: MetaCampaignStatus;
    specialAdCategories?: string[];
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    bidStrategy?: string | null;
    spendCap?: number | null;
    /** Required when daily/lifetime campaign budget is omitted (ad-set budgets). */
    isAdsetBudgetSharingEnabled?: boolean | null;
  } & MetaGraphAuth,
): Promise<{ id: string }> {
  const usesAdsetBudget = input.dailyBudget == null && input.lifetimeBudget == null;
  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/campaigns`, {
    method: 'POST',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      name: input.name,
      objective: input.objective,
      status: input.status ?? 'PAUSED',
      ...(input.dailyBudget != null ? { daily_budget: String(Math.floor(input.dailyBudget)) } : {}),
      ...(input.lifetimeBudget != null ? { lifetime_budget: String(Math.floor(input.lifetimeBudget)) } : {}),
      ...(input.bidStrategy ? { bid_strategy: input.bidStrategy } : {}),
      ...(input.spendCap != null ? { spend_cap: String(Math.floor(input.spendCap)) } : {}),
      ...(input.specialAdCategories?.length
        ? { special_ad_categories: JSON.stringify(input.specialAdCategories) }
        : {}),
      ...(usesAdsetBudget
        ? {
            is_adset_budget_sharing_enabled: String(
              input.isAdsetBudgetSharingEnabled === true,
            ),
          }
        : {}),
    },
  });
  return assertOk(resp);
}

export async function createAdSet(
  input: {
    adAccountId: string;
    name: string;
    campaignId: string; // meta campaign id
    status?: MetaAdSetStatus;
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    bidStrategy?: string | null;
    bidAmount?: number | null;
    bidConstraints?: Record<string, unknown> | null;
    optimizationGoal?: string | null;
    billingEvent?: string | null;
    targeting?: Record<string, unknown> | null;
    /** Meta expects Unix seconds as a string. */
    startTime?: string | null;
    endTime?: string | null;
    promotedObject?: Record<string, string> | null;
    destinationType?: string | null;
    pacingType?: string | null;
  } & MetaGraphAuth,
): Promise<{ id: string }> {
  const billingEvent = input.billingEvent?.trim() || 'IMPRESSIONS';
  const optimizationGoal = input.optimizationGoal?.trim() || 'OFFSITE_CONVERSIONS';

  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/adsets`, {
    method: 'POST',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      name: input.name,
      campaign_id: input.campaignId,
      status: input.status ?? 'PAUSED',
      billing_event: billingEvent,
      optimization_goal: optimizationGoal,
      ...(input.dailyBudget != null ? { daily_budget: String(Math.floor(input.dailyBudget)) } : {}),
      ...(input.lifetimeBudget != null ? { lifetime_budget: String(Math.floor(input.lifetimeBudget)) } : {}),
      ...(input.bidStrategy ? { bid_strategy: input.bidStrategy } : {}),
      ...(input.bidConstraints && Object.keys(input.bidConstraints).length > 0
        ? { bid_constraints: JSON.stringify(input.bidConstraints) }
        : {}),
      ...(input.bidAmount != null && !input.bidConstraints?.roas_average_floor
        ? { bid_amount: String(Math.floor(input.bidAmount)) }
        : {}),
      ...(input.targeting ? { targeting: JSON.stringify(input.targeting) } : {}),
      ...(input.startTime ? { start_time: input.startTime } : {}),
      ...(input.endTime ? { end_time: input.endTime } : {}),
      ...(input.promotedObject && Object.keys(input.promotedObject).length > 0
        ? { promoted_object: JSON.stringify(input.promotedObject) }
        : {}),
      ...(input.destinationType ? { destination_type: input.destinationType } : {}),
      pacing_type: toMetaPacingTypeParam(input.pacingType),
    },
  });
  return assertOk(resp);
}

export async function uploadAdImage(
  input: {
    adAccountId: string;
    bytes: Uint8Array;
    filename: string;
  } & MetaGraphAuth,
): Promise<{ imageHash: string }> {
  const token = await resolveMetaFetchToken({
    companyId: input.companyId,
    accessToken: input.accessToken,
  });
  const url = new URL(`${META_GRAPH_BASE}/${input.adAccountId}/adimages`);
  url.searchParams.set('access_token', token);

  const form = new FormData();
  form.set('filename', input.filename);

  // Ensure BlobPart is an ArrayBuffer (not SharedArrayBuffer-backed view)
  const bytesForBlob: ArrayBuffer = input.bytes.buffer instanceof ArrayBuffer
    ? input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength)
    : input.bytes.slice().buffer;
  form.set(
    'bytes',
    new Blob([bytesForBlob], { type: 'application/octet-stream' }),
  );

  const res = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
  const json = (await res.json()) as {
    images?: Record<string, { hash?: string }>;
    error?: { message?: string };
  };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Meta API error (${res.status})`);

  const first = json.images ? Object.values(json.images)[0] : null;
  const hash = first?.hash;
  if (!hash) throw new Error('Meta image upload failed (missing hash)');
  return { imageHash: hash };
}

export async function uploadAdVideo(
  input: {
    adAccountId: string;
    bytes: Uint8Array;
    filename: string;
    name: string;
  } & MetaGraphAuth,
): Promise<{ videoId: string }> {
  // Simple (non-resumable) upload path; Meta may require resumable for large files.
  // This is sufficient for MVP + typical small creatives; worker retries on failure.
  const token = await resolveMetaFetchToken({
    companyId: input.companyId,
    accessToken: input.accessToken,
  });
  const url = new URL(`${META_GRAPH_BASE}/${input.adAccountId}/advideos`);
  url.searchParams.set('access_token', token);

  const form = new FormData();
  form.set('name', input.name);
  // Ensure BlobPart is an ArrayBuffer (not SharedArrayBuffer-backed view)
  const bytesForBlob: ArrayBuffer = input.bytes.buffer instanceof ArrayBuffer
    ? input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength)
    : input.bytes.slice().buffer;
  form.set('source', new Blob([bytesForBlob], { type: 'application/octet-stream' }), input.filename);

  const res = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Meta API error (${res.status})`);
  if (!json.id) throw new Error('Meta video upload failed (missing id)');
  return { videoId: json.id };
}

export async function createAdCreative(
  input: {
    adAccountId: string;
    fbPageId: string;
    headline: string;
    primaryText: string;
    description?: string | null;
    ctaType: string;
    landingUrl: string;
    imageHash?: string | null;
    videoId?: string | null;
    /** Public URL for video thumbnail (Meta `video_data.image_url`). Required for video creatives. */
    videoThumbnailUrl?: string | null;
    pixelIds?: string[] | null;
  } & MetaGraphAuth,
): Promise<{ id: string }> {
  // For simplicity, use object_story_spec with link_data (image) or video_data (video).
  const objectStorySpec: Record<string, unknown> = {
    page_id: input.fbPageId,
  };

  if (input.imageHash) {
    objectStorySpec.link_data = {
      link: input.landingUrl,
      message: input.primaryText,
      name: input.headline,
      description: input.description ?? undefined,
      call_to_action: { type: input.ctaType, value: { link: input.landingUrl } },
      image_hash: input.imageHash,
    };
  } else if (input.videoId) {
    const imageUrl = input.videoThumbnailUrl?.trim();
    if (!imageUrl) {
      throw new Error(
        'Video ad creative requires videoThumbnailUrl (public R2 image_url for Meta video_data)',
      );
    }
    objectStorySpec.video_data = {
      video_id: input.videoId,
      image_url: imageUrl,
      message: input.primaryText,
      title: input.headline,
      call_to_action: { type: input.ctaType, value: { link: input.landingUrl } },
    };
  } else {
    throw new Error('Missing creative media (imageHash or videoId)');
  }

  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/adcreatives`, {
    method: 'POST',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      name: `Robust Creative — ${input.headline.slice(0, 48)}`,
      object_story_spec: JSON.stringify(objectStorySpec),
      ...(input.pixelIds?.length ? { pixel_id: input.pixelIds[0] } : {}),
    },
  });
  return assertOk(resp);
}

export async function createAd(
  input: {
    adAccountId: string;
    adSetId: string; // meta adset id
    creativeId: string; // meta creative id
    name: string;
    status: MetaAdStatus;
  } & MetaGraphAuth,
): Promise<{ id: string }> {
  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/ads`, {
    method: 'POST',
    companyId: input.companyId,
    accessToken: input.accessToken,
    searchParams: {
      name: input.name,
      adset_id: input.adSetId,
      status: input.status,
      creative: JSON.stringify({ creative_id: input.creativeId }),
    },
  });
  return assertOk(resp);
}

