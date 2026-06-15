import type { MetaAdsAutoConfigData } from './config';

export type AutoAdsPermissionAction =
  | 'new_campaign'
  | 'new_adset'
  | 'static_generation'
  | 'auto_post';

export type AutoAdsPermissionResult =
  | { allowed: true }
  | { allowed: false; reason: string; fallbackStep: 'campaignChoice' | 'adsetChoice' | 'mediaSource' };

export function checkAutoPermission(
  config: MetaAdsAutoConfigData,
  action: AutoAdsPermissionAction,
): AutoAdsPermissionResult {
  switch (action) {
    case 'new_campaign':
      if (!config.allowNewCampaign) {
        return {
          allowed: false,
          reason: 'New campaign creation is disabled in your Ads Automation settings.',
          fallbackStep: 'campaignChoice',
        };
      }
      return { allowed: true };
    case 'new_adset':
      if (!config.allowNewAdset) {
        return {
          allowed: false,
          reason: 'New ad set creation is disabled in your Ads Automation settings.',
          fallbackStep: 'adsetChoice',
        };
      }
      return { allowed: true };
    case 'static_generation':
      if (!config.allowStaticGeneration || config.mediaMode !== 'auto_generate') {
        return {
          allowed: false,
          reason: 'Auto static generation is disabled. Choose media manually.',
          fallbackStep: 'mediaSource',
        };
      }
      return { allowed: true };
    case 'auto_post':
      if (!config.autoPost) {
        return { allowed: false, reason: 'Auto post is disabled.', fallbackStep: 'mediaSource' };
      }
      return { allowed: true };
    default:
      return { allowed: true };
  }
}

export function assertAutoPermission(
  config: MetaAdsAutoConfigData,
  action: AutoAdsPermissionAction,
): void {
  const result = checkAutoPermission(config, action);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
}
