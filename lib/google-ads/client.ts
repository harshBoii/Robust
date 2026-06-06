import 'server-only';

/**
 * Google Ads API client.
 *
 * Uses the `google-ads-api` npm package which wraps the Google Ads gRPC API.
 * Each public function receives a `refreshToken` + `customerId` so callers
 * never have to instantiate the client themselves.
 *
 * All micro-currency values (budgets, bids) are in micros (1,000,000 micros = 1 unit).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GoogleAdsApi } = require('google-ads-api') as typeof import('google-ads-api');
import { googleAdsErrorFromRaw } from '@/lib/google-ads/errors';
import { requireGoogleAdsEnv } from '@/lib/google-ads/integration-token';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoogleAdStatus = 'ACTIVE' | 'PAUSED';
export type GoogleCampaignStatus = 'ACTIVE' | 'PAUSED' | 'REMOVED';

export type GoogleCampaignType = 'SEARCH' | 'DISPLAY' | 'PERFORMANCE_MAX';

export type CreateCampaignInput = {
  name: string;
  campaignType: GoogleCampaignType;
  biddingStrategy?: string;
  dailyBudgetMicros?: number;
  totalBudgetMicros?: number;
  targetCpaMicros?: number;
  targetRoas?: number;
  status?: GoogleCampaignStatus;
  geoTargets?: string[];
  languages?: string[];
};

export type CreateAdGroupInput = {
  campaignResourceName: string;
  name: string;
  cpcBidMicros?: number;
  status?: string;
};

export type Keyword = {
  text: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
};

export type CreateAssetGroupInput = {
  campaignResourceName: string;
  name: string;
  finalUrl: string;
  mobileUrl?: string;
  path1?: string;
  path2?: string;
  headlines: string[];
  longHeadline: string;
  descriptions: string[];
  businessName: string;
};

export type UploadImageAssetInput = {
  name: string;
  dataBase64: string;
  mimeType?: string;
};

export type UploadYoutubeAssetInput = {
  youtubeVideoId: string;
  name: string;
};

export type RSAInput = {
  adGroupResourceName: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
  status?: string;
};

export type RDAInput = {
  adGroupResourceName: string;
  headlines: string[];
  longHeadline: string;
  descriptions: string[];
  businessName: string;
  marketingImageResourceNames: string[];
  squareImageResourceNames: string[];
  logoImageResourceNames?: string[];
  finalUrl: string;
  status?: string;
};

export type GoogleCampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  dailyBudgetMicros?: string;
};

export type GoogleAdGroupRow = {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  cpcBidMicros?: string;
};

// ─── Client factory ───────────────────────────────────────────────────────────

function makeClient(refreshToken: string, customerId: string, loginCustomerId?: string | null) {
  const env = requireGoogleAdsEnv();
  const client = new GoogleAdsApi({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    developer_token: env.developerToken,
  });

  return client.Customer({
    customer_id: customerId,
    login_customer_id: loginCustomerId ?? customerId,
    refresh_token: refreshToken,
  });
}

// ─── Campaign operations ──────────────────────────────────────────────────────

export async function createGoogleCampaign(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  campaign: CreateCampaignInput;
}): Promise<{ id: string; resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);

    // Create budget first
    const budgetResult = await customer.campaignBudgets.create([
      {
        name: `Budget for ${input.campaign.name}`,
        delivery_method: 'STANDARD',
        amount_micros: input.campaign.dailyBudgetMicros ?? 5_000_000,
        total_amount_micros: input.campaign.totalBudgetMicros ?? undefined,
        explicitly_shared: false,
      } as never,
    ]);

    const budgetResourceName = (budgetResult as { results?: Array<{ resource_name?: string }> })
      ?.results?.[0]?.resource_name;
    if (!budgetResourceName) throw new Error('Failed to create campaign budget');

    const channelTypeMap: Record<GoogleCampaignType, string> = {
      SEARCH: 'SEARCH',
      DISPLAY: 'DISPLAY',
      PERFORMANCE_MAX: 'PERFORMANCE_MAX',
    };

    const campaignObj: Record<string, unknown> = {
      name: input.campaign.name,
      status: input.campaign.status ?? 'PAUSED',
      advertising_channel_type: channelTypeMap[input.campaign.campaignType],
      campaign_budget: budgetResourceName,
    };

    // Bidding strategy
    if (input.campaign.biddingStrategy === 'MAXIMIZE_CONVERSIONS') {
      campaignObj['bidding_strategy_type'] = 'MAXIMIZE_CONVERSIONS';
      campaignObj['maximize_conversions'] = {};
    } else if (input.campaign.biddingStrategy === 'MAXIMIZE_CONVERSION_VALUE') {
      campaignObj['bidding_strategy_type'] = 'MAXIMIZE_CONVERSION_VALUE';
      campaignObj['maximize_conversion_value'] = {};
    } else if (input.campaign.biddingStrategy === 'TARGET_CPA' && input.campaign.targetCpaMicros) {
      campaignObj['bidding_strategy_type'] = 'TARGET_CPA';
      campaignObj['target_cpa'] = { target_cpa_micros: input.campaign.targetCpaMicros };
    } else if (input.campaign.biddingStrategy === 'TARGET_ROAS' && input.campaign.targetRoas) {
      campaignObj['bidding_strategy_type'] = 'TARGET_ROAS';
      campaignObj['target_roas'] = { target_roas: input.campaign.targetRoas };
    } else {
      // Default MANUAL_CPC for search/display
      if (input.campaign.campaignType !== 'PERFORMANCE_MAX') {
        campaignObj['bidding_strategy_type'] = 'MANUAL_CPC';
        campaignObj['manual_cpc'] = { enhanced_cpc_enabled: false };
      }
    }

    const result = await customer.campaigns.create([campaignObj as never]);
    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('Campaign creation returned no resource name');

    const campaignId = resourceName.split('/').pop()!;
    return { id: campaignId, resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function getCampaignsForCustomer(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
}): Promise<GoogleCampaignRow[]> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const campaigns = await customer.query(
      `SELECT campaign.id, campaign.name, campaign.advertising_channel_type, campaign.status,
              campaign_budget.amount_micros
       FROM campaign
       WHERE campaign.status != 'REMOVED'
       ORDER BY campaign.id DESC
       LIMIT 100`,
    );

    return (campaigns as Array<Record<string, Record<string, unknown>>>).map((row) => ({
      id: String(row.campaign?.id ?? ''),
      name: String(row.campaign?.name ?? ''),
      type: String(row.campaign?.advertising_channel_type ?? ''),
      status: String(row.campaign?.status ?? ''),
      dailyBudgetMicros: row.campaign_budget?.amount_micros
        ? String(row.campaign_budget.amount_micros)
        : undefined,
    }));
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function updateGoogleAdStatus(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  adResourceName: string;
  status: GoogleAdStatus;
}): Promise<void> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    await customer.ads.update([
      { resource_name: input.adResourceName, status: input.status } as never,
    ]);
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

// ─── Ad Group operations ──────────────────────────────────────────────────────

export async function createGoogleAdGroup(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  adGroup: CreateAdGroupInput;
}): Promise<{ id: string; resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const result = await customer.adGroups.create([
      {
        name: input.adGroup.name,
        campaign: input.adGroup.campaignResourceName,
        status: input.adGroup.status ?? 'PAUSED',
        cpc_bid_micros: input.adGroup.cpcBidMicros ?? 1_000_000,
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('Ad group creation returned no resource name');

    const id = resourceName.split('/').pop()!;
    return { id, resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function addKeywordsToAdGroup(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  adGroupResourceName: string;
  keywords: Keyword[];
}): Promise<void> {
  if (!input.keywords.length) return;
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const criteria = input.keywords.map((kw) => ({
      ad_group: input.adGroupResourceName,
      status: 'ENABLED',
      keyword: {
        text: kw.text,
        match_type: kw.matchType,
      },
    }));
    await customer.adGroupCriteria.create(criteria as never[]);
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function getAdGroupsForCampaign(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  campaignId: string;
}): Promise<GoogleAdGroupRow[]> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const rows = await customer.query(
      `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros,
              campaign.id
       FROM ad_group
       WHERE campaign.id = '${input.campaignId}'
         AND ad_group.status != 'REMOVED'`,
    );

    return (rows as Array<Record<string, Record<string, unknown>>>) .map((r) => ({
      id: String(r.ad_group?.id ?? ''),
      campaignId: String(r.campaign?.id ?? ''),
      name: String(r.ad_group?.name ?? ''),
      status: String(r.ad_group?.status ?? ''),
      cpcBidMicros: r.ad_group?.cpc_bid_micros ? String(r.ad_group.cpc_bid_micros) : undefined,
    }));
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

// ─── Asset Group (PMax) operations ───────────────────────────────────────────

export async function createGoogleAssetGroup(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  campaignResourceName: string;
  assetGroup: CreateAssetGroupInput;
}): Promise<{ id: string; resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const ag = input.assetGroup;

    const result = await customer.assetGroups.create([
      {
        name: ag.name,
        campaign: ag.campaignResourceName,
        status: 'PAUSED',
        final_urls: [ag.finalUrl],
        final_mobile_urls: ag.mobileUrl ? [ag.mobileUrl] : undefined,
        path1: ag.path1,
        path2: ag.path2,
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('Asset group creation returned no resource name');

    const id = resourceName.split('/').pop()!;
    return { id, resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

// ─── Media / Asset upload operations ─────────────────────────────────────────

export async function uploadImageAsset(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  asset: UploadImageAssetInput;
}): Promise<{ resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const result = await customer.assets.create([
      {
        name: input.asset.name,
        type: 'IMAGE',
        image_asset: {
          data: input.asset.dataBase64,
          mime_type: input.asset.mimeType ?? 'IMAGE_JPEG',
        },
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('Image asset upload returned no resource name');
    return { resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function uploadYoutubeAsset(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  asset: UploadYoutubeAssetInput;
}): Promise<{ resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const result = await customer.assets.create([
      {
        name: input.asset.name,
        type: 'YOUTUBE_VIDEO',
        youtube_video_asset: {
          youtube_video_id: input.asset.youtubeVideoId,
        },
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('YouTube asset upload returned no resource name');
    return { resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

// ─── Ad creation operations ───────────────────────────────────────────────────

export async function createResponsiveSearchAd(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  rsa: RSAInput;
}): Promise<{ id: string; resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const rsa = input.rsa;

    const result = await customer.ads.create([
      {
        ad_group: rsa.adGroupResourceName,
        status: rsa.status ?? 'PAUSED',
        ad: {
          final_urls: [rsa.finalUrl],
          responsive_search_ad: {
            headlines: rsa.headlines.map((text) => ({ text })),
            descriptions: rsa.descriptions.map((text) => ({ text })),
            path1: rsa.path1,
            path2: rsa.path2,
          },
        },
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('RSA creation returned no resource name');

    const id = resourceName.split('/').pop()!;
    return { id, resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

export async function createResponsiveDisplayAd(input: {
  refreshToken: string;
  customerId: string;
  loginCustomerId?: string | null;
  rda: RDAInput;
}): Promise<{ id: string; resourceName: string }> {
  try {
    const customer = makeClient(input.refreshToken, input.customerId, input.loginCustomerId);
    const rda = input.rda;

    const result = await customer.ads.create([
      {
        ad_group: rda.adGroupResourceName,
        status: rda.status ?? 'PAUSED',
        ad: {
          final_urls: [rda.finalUrl],
          responsive_display_ad: {
            headlines: rda.headlines.map((text) => ({ text })),
            long_headline: { text: rda.longHeadline },
            descriptions: rda.descriptions.map((text) => ({ text })),
            business_name: rda.businessName,
            marketing_images: rda.marketingImageResourceNames.map((resource_name) => ({
              asset: resource_name,
            })),
            square_marketing_images: rda.squareImageResourceNames.map((resource_name) => ({
              asset: resource_name,
            })),
            logo_images:
              rda.logoImageResourceNames?.map((resource_name) => ({ asset: resource_name })) ?? [],
          },
        },
      } as never,
    ]);

    const resourceName = (result as { results?: Array<{ resource_name?: string }> })?.results?.[0]
      ?.resource_name;
    if (!resourceName) throw new Error('RDA creation returned no resource name');

    const id = resourceName.split('/').pop()!;
    return { id, resourceName };
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}

// ─── Account / customer listing ───────────────────────────────────────────────

export async function listAccessibleCustomers(input: {
  refreshToken: string;
}): Promise<Array<{ id: string; descriptiveName?: string; testAccount?: boolean }>> {
  try {
    const env = requireGoogleAdsEnv();
    const client = new GoogleAdsApi({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      developer_token: env.developerToken,
    });

    // Use the top-level listAccessibleCustomers API
    const result = await (
      client as unknown as {
        listAccessibleCustomers: (
          token: string,
        ) => Promise<{ resource_names?: string[] }>;
      }
    ).listAccessibleCustomers(input.refreshToken);

    return (result.resource_names ?? []).map((rn) => ({
      id: rn.replace('customers/', ''),
    }));
  } catch (err) {
    throw googleAdsErrorFromRaw(err);
  }
}
