export type Campaign = { id: string; name: string; objective?: string; status?: string };
export type AdSet = { id: string; name: string; status?: string };
export type Preset = { id: string; name: string };

export type AssetBucket = { id: string; label: string; assetCount?: number };

export type Asset = {
  id: string;
  title: string;
  filename?: string | null;
  thumbnailUrl: string | null;
  playbackUrl?: string | null;
  assetType: string;
  bulkUploadId: string | null;
  assetBucketId: string | null;
};

export type CreativeFields = {
  headline: string;
  primaryText: string;
  description: string;
  landingUrl: string;
  ctaType: string;
  pixelId: string;
};

/** Google Ads creative fields for RSA / RDA / PMax. */
export type GoogleCreativeFields = {
  /** Up to 15 for RSA, 5 for RDA/PMax */
  headlines: string[];
  /** Up to 4 for RSA, 5 for RDA/PMax */
  descriptions: string[];
  /** Required for RDA and PMax */
  longHeadline?: string;
  /** Required for RDA and PMax */
  businessName?: string;
  finalUrl: string;
  path1?: string;
  path2?: string;
};

export type GroupModel = {
  bucketId: string;
  label: string;
  assetIds: string[];
  assets: Asset[];
  included: boolean;
  /** Meta: DB id of MetaAdSet */
  adSetId: string;
  creative: CreativeFields;
  /** Google: DB id of GoogleAdGroup or GoogleAssetGroup */
  googleAdGroupId?: string;
  /** Google Ads creative fields (used when platform === 'GOOGLE') */
  googleCreative?: GoogleCreativeFields;
};


