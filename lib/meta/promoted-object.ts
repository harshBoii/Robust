import 'server-only';

import { getAdAccountPixels } from '@/lib/meta/client';
import {
  normalizePromotedObject,
  optimizationGoalRequiresPixel,
} from '@/lib/meta/adset-preset-meta';

/**
 * Build promoted_object for ad set create. Uses preset pixel_id, else first available
 * pixel on the ad account.
 */
export async function resolvePromotedObjectForMeta(input: {
  optimizationGoal: string;
  promotedObject: unknown;
  adAccountId: string;
  companyId: string;
}): Promise<Record<string, string> | null> {
  const normalized = normalizePromotedObject(input.promotedObject);

  if (!optimizationGoalRequiresPixel(input.optimizationGoal)) {
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  let pixelId = normalized.pixel_id;
  if (!pixelId) {
    try {
      const pixels = await getAdAccountPixels(input.adAccountId, {
        companyId: input.companyId,
      });
      const available = pixels.find((p) => p.is_unavailable !== true) ?? pixels[0];
      pixelId = available?.id;
    } catch (err) {
      console.error('[meta] failed to fetch ad account pixels:', err);
    }
  }

  if (!pixelId) {
    throw new Error(
      'pixel_id is missing in the ad set preset promoted_object and no pixel was found on the ad account. ' +
        'Add your Meta Pixel ID in Workspace → Presets → Conversion Tracking (Events Manager), or connect a pixel to this ad account.',
    );
  }

  return {
    pixel_id: pixelId,
    custom_event_type: normalized.custom_event_type || 'PURCHASE',
  };
}
