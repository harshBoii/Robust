import type { ImageArtistId } from '@/lib/image-gen/image-artists';
import { DEFAULT_IMAGE_ARTIST_ID } from '@/lib/image-gen/image-artists';

export type MetaAdsMediaMode = 'auto_generate' | 'manual_selection';

export type MetaAdsAutoConfigData = {
  autoModeDefault: boolean;
  allowNewCampaign: boolean;
  allowNewAdset: boolean;
  allowStaticGeneration: boolean;
  mediaMode: MetaAdsMediaMode;
  defaultArtistId: ImageArtistId;
  autoPost: boolean;
  defaultDailyBudget: number | null;
  defaultObjective: string | null;
};

export const DEFAULT_META_ADS_AUTO_CONFIG: MetaAdsAutoConfigData = {
  autoModeDefault: false,
  allowNewCampaign: true,
  allowNewAdset: true,
  allowStaticGeneration: true,
  mediaMode: 'auto_generate',
  defaultArtistId: DEFAULT_IMAGE_ARTIST_ID,
  autoPost: false,
  defaultDailyBudget: null,
  defaultObjective: null,
};
