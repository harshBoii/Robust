/** Shared TypeScript types for Google Ads (not Prisma client types). */

export type GoogleCampaignPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  campaignType: string;
  biddingStrategy: string | null;
  dailyBudgetMicros: string | null;
  totalBudgetMicros: string | null;
  targetCpaMicros: string | null;
  targetRoas: number | null;
  geoTargets: string[] | null;
  languages: string[] | null;
  status: string | null;
};

export type GoogleAdGroupPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  keywords: Array<{ text: string; matchType: 'EXACT' | 'PHRASE' | 'BROAD' }> | null;
  targeting: Record<string, unknown> | null;
  cpcBidMicros: string | null;
};

export type GoogleAssetGroupPreset = {
  id: string;
  name: string;
  isDefault: boolean;
  finalUrl: string | null;
  path1: string | null;
  path2: string | null;
  headlines: string[] | null;
  descriptions: string[] | null;
  longHeadline: string | null;
  businessName: string | null;
};

export type GoogleCampaignOption = {
  id: string;
  name: string;
  campaignType: string;
  status?: string | null;
};

export type GoogleAdGroupOption = {
  id: string;
  campaignId: string;
  name: string;
  status?: string | null;
};

export type GoogleCreativeFields = {
  headlines: string[];
  descriptions: string[];
  longHeadline?: string;
  businessName?: string;
  finalUrl: string;
  path1?: string;
  path2?: string;
};
