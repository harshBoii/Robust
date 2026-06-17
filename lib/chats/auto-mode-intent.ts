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
