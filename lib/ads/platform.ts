/** Thin shared layer — platform identity and cross-platform types. */

export type AdPlatform = 'META' | 'GOOGLE';

export type GoogleCampaignType = 'SEARCH' | 'DISPLAY' | 'PERFORMANCE_MAX';

export const GOOGLE_CAMPAIGN_TYPES: { value: GoogleCampaignType; label: string; description: string }[] = [
  {
    value: 'SEARCH',
    label: 'Search',
    description: 'Text ads shown in Google Search results. Great for capturing intent.',
  },
  {
    value: 'DISPLAY',
    label: 'Display',
    description: 'Image and text ads shown across Google Display Network websites.',
  },
  {
    value: 'PERFORMANCE_MAX',
    label: 'Performance Max',
    description: 'AI-optimised campaigns across all Google channels. Provide assets and let Google optimise.',
  },
];

export const PLATFORM_LABELS: Record<AdPlatform, string> = {
  META: 'Meta',
  GOOGLE: 'Google Ads',
};

export type PublishJobStatus = 'QUEUED' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';
