import 'server-only';

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

function requireSystemAccessToken() {
  const token = process.env.META_SYSTEM_ACCESS_TOKEN;
  if (!token) {
    throw new Error('META_SYSTEM_ACCESS_TOKEN is not set');
  }
  return token;
}

async function metaFetch<T>(
  path: string,
  init?: RequestInit & { searchParams?: Record<string, string> },
): Promise<T> {
  const token = requireSystemAccessToken();
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', token);
  if (init?.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = (await res.json()) as MetaGraphResponse<T>;
  if (!res.ok || json.error) {
    const message = json.error?.message ?? `Meta API error (${res.status})`;
    throw new Error(message);
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

export async function getAdCreativePreviews(input: {
  creativeId: string;
  adFormat?: string;
}): Promise<MetaCreativePreviewRow[]> {
  const resp = await metaFetch<{ data?: MetaCreativePreviewRow[] }>(`/${input.creativeId}/previews`, {
    method: 'GET',
    searchParams: {
      ad_format: input.adFormat ?? 'DESKTOP_FEED_STANDARD',
    },
  });
  return resp.data ?? [];
}

export async function getAdsWithInsights(input: {
  adAccountId: string;
  datePreset: 'today' | 'maximum' | 'last_7d' | 'last_30d';
  timeIncrement?: number;
  timeRange?: { since: string; until: string };
}): Promise<MetaAdRow[]> {
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
    'creative{thumbnail_url}',
    'campaign{id,name,objective,status,daily_budget}',
    'adset{id,name,status,daily_budget}',
    `insights.${insightsParts.join('.')}`,
  ].join(',');

  const resp = await metaFetch<{ data: MetaAdRow[] }>(`/${adAccountId}/ads`, {
    method: 'GET',
    searchParams: {
      fields,
      limit: '100',
    },
  });

  return resp.data ?? [];
}

export async function updateAdStatus(input: {
  adId: string;
  status: MetaAdStatus;
}): Promise<void> {
  const { adId, status } = input;
  await metaFetch<Record<string, unknown>>(`/${adId}`, {
    method: 'POST',
    searchParams: {
      status,
    },
  });
}

export type MetaAdAccount = { id: string; name?: string };
export type MetaPage = { id: string; name?: string };

export async function getMyAdAccounts(): Promise<MetaAdAccount[]> {
  const resp = await metaFetch<{ data: MetaAdAccount[] }>('/me/adaccounts', {
    method: 'GET',
    searchParams: {
      fields: 'id,name',
      limit: '200',
    },
  });
  return resp.data ?? [];
}

export async function getMyPages(): Promise<MetaPage[]> {
  const resp = await metaFetch<{ data: MetaPage[] }>('/me/accounts', {
    method: 'GET',
    searchParams: {
      fields: 'id,name',
      limit: '200',
    },
  });
  return resp.data ?? [];
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

export async function getCampaignsForAccount(input: {
  adAccountId: string;
}): Promise<MetaCampaignRow[]> {
  const resp = await metaFetch<{ data: MetaCampaignRow[] }>(`/${input.adAccountId}/campaigns`, {
    method: 'GET',
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

export async function getAdSetsForCampaign(input: {
  metaCampaignId: string;
}): Promise<MetaAdSetRow[]> {
  const resp = await metaFetch<{ data: MetaAdSetRow[] }>(`/${input.metaCampaignId}/adsets`, {
    method: 'GET',
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

export async function createCampaign(input: {
  adAccountId: string;
  name: string;
  objective: string;
  status?: MetaCampaignStatus;
  specialAdCategories?: string[];
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  bidStrategy?: string | null;
  spendCap?: number | null;
}): Promise<{ id: string }> {
  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/campaigns`, {
    method: 'POST',
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
    },
  });
  return assertOk(resp);
}

export async function createAdSet(input: {
  adAccountId: string;
  name: string;
  campaignId: string; // meta campaign id
  status?: MetaAdSetStatus;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  bidStrategy?: string | null;
  bidAmount?: number | null;
  optimizationGoal?: string | null;
  billingEvent?: string | null;
  targeting?: Record<string, unknown> | null;
  startTime?: string | null;
  endTime?: string | null;
}): Promise<{ id: string }> {
  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/adsets`, {
    method: 'POST',
    searchParams: {
      name: input.name,
      campaign_id: input.campaignId,
      status: input.status ?? 'PAUSED',
      ...(input.dailyBudget != null ? { daily_budget: String(Math.floor(input.dailyBudget)) } : {}),
      ...(input.lifetimeBudget != null ? { lifetime_budget: String(Math.floor(input.lifetimeBudget)) } : {}),
      ...(input.bidStrategy ? { bid_strategy: input.bidStrategy } : {}),
      ...(input.bidAmount != null ? { bid_amount: String(Math.floor(input.bidAmount)) } : {}),
      ...(input.optimizationGoal ? { optimization_goal: input.optimizationGoal } : {}),
      ...(input.billingEvent ? { billing_event: input.billingEvent } : {}),
      ...(input.targeting ? { targeting: JSON.stringify(input.targeting) } : {}),
      ...(input.startTime ? { start_time: input.startTime } : {}),
      ...(input.endTime ? { end_time: input.endTime } : {}),
    },
  });
  return assertOk(resp);
}

export async function uploadAdImage(input: {
  adAccountId: string;
  bytes: Uint8Array;
  filename: string;
}): Promise<{ imageHash: string }> {
  const token = requireSystemAccessToken();
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

export async function uploadAdVideo(input: {
  adAccountId: string;
  bytes: Uint8Array;
  filename: string;
  name: string;
}): Promise<{ videoId: string }> {
  // Simple (non-resumable) upload path; Meta may require resumable for large files.
  // This is sufficient for MVP + typical small creatives; worker retries on failure.
  const token = requireSystemAccessToken();
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

export async function createAdCreative(input: {
  adAccountId: string;
  fbPageId: string;
  headline: string;
  primaryText: string;
  description?: string | null;
  ctaType: string;
  landingUrl: string;
  imageHash?: string | null;
  videoId?: string | null;
  pixelIds?: string[] | null;
}): Promise<{ id: string }> {
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
    objectStorySpec.video_data = {
      video_id: input.videoId,
      message: input.primaryText,
      title: input.headline,
      call_to_action: { type: input.ctaType, value: { link: input.landingUrl } },
    };
  } else {
    throw new Error('Missing creative media (imageHash or videoId)');
  }

  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/adcreatives`, {
    method: 'POST',
    searchParams: {
      name: `Robust Creative — ${input.headline.slice(0, 48)}`,
      object_story_spec: JSON.stringify(objectStorySpec),
      ...(input.pixelIds?.length ? { pixel_id: input.pixelIds[0] } : {}),
    },
  });
  return assertOk(resp);
}

export async function createAd(input: {
  adAccountId: string;
  adSetId: string; // meta adset id
  creativeId: string; // meta creative id
  name: string;
  status: MetaAdStatus;
}): Promise<{ id: string }> {
  const resp = await metaFetch<{ id: string }>(`/${input.adAccountId}/ads`, {
    method: 'POST',
    searchParams: {
      name: input.name,
      adset_id: input.adSetId,
      status: input.status,
      creative: JSON.stringify({ creative_id: input.creativeId }),
    },
  });
  return assertOk(resp);
}

