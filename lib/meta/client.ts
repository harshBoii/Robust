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

