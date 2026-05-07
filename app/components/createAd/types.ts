export type Campaign = { id: string; name: string; objective?: string; status?: string };
export type AdSet = { id: string; name: string; status?: string };
export type Preset = { id: string; name: string };

export type AssetBucket = { id: string; label: string; assetCount?: number };

export type Asset = {
  id: string;
  title: string;
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

export type GroupModel = {
  bucketId: string;
  label: string;
  assetIds: string[];
  assets: Asset[];
  included: boolean;
  adSetId: string;
  creative: CreativeFields;
};

