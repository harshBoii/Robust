import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/defaults';

import type { WorkflowState } from './types';

export function isAutoModeActive(
  state: WorkflowState,
  config: Pick<MetaAdsAutoConfigData, 'autoModeDefault'>,
): boolean {
  if (state.autoMode === true) return true;
  if (state.autoMode === false) return false;
  return config.autoModeDefault;
}

/** First-message intent is treated as Meta ads (static image generation inside auto pipeline). */
export function looksLikeMetaAdsCreationIntent(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  if (
    /geo\b|aeo\b|seo\b|citation|bounty|share of voice|geoknight|organic visibility|get cited/.test(
      lower,
    ) &&
    !/meta|facebook|instagram|ad\b|ads\b|campaign/.test(lower)
  ) {
    return false;
  }

  if (
    /video ad|heygen|ugc video|video script/.test(lower) &&
    !/static|image|photo/.test(lower)
  ) {
    return false;
  }

  return (
    /\bads?\b/.test(lower) ||
    /campaign/.test(lower) ||
    /static/.test(lower) ||
    /meta|facebook|instagram|google ads?/.test(lower) ||
    (/creat|generat|make|launch|publish|post/.test(lower) &&
      /ad|campaign|creative|static|image|holi|diwali|sale|promo/.test(lower))
  );
}
