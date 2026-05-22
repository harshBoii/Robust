import 'server-only';

import { resolveAssetImageUrl } from './resolve-asset-image-url';
import type { ImageGenState } from './types';

export type LastGeneratedImageRef = {
  assetId: string;
  imageUrl?: string;
};

/** Most recent generated image in this session (for variant base / regenerate reference). */
export function resolveLastGeneratedImageRef(ig: ImageGenState): LastGeneratedImageRef | null {
  const assets = ig.generatedAssets ?? [];
  if (assets.length > 0) {
    const last = assets[assets.length - 1]!;
    return { assetId: last.assetId, imageUrl: last.imageUrl };
  }

  if (ig.onModelGeneratedAssetId) {
    return {
      assetId: ig.onModelGeneratedAssetId,
      imageUrl: ig.onModelGeneratedImageUrl,
    };
  }

  if (ig.baseGeneratedAssetId) {
    return {
      assetId: ig.baseGeneratedAssetId,
      imageUrl: ig.baseGeneratedImageUrl,
    };
  }

  const templateOut = [...(ig.templateOutputs ?? [])].reverse().find((o) => o.status === 'done' && o.assetId);
  if (templateOut?.assetId) {
    return { assetId: templateOut.assetId, imageUrl: templateOut.imageUrl };
  }

  const variants = ig.variants ?? [];
  for (let i = variants.length - 1; i >= 0; i--) {
    const v = variants[i];
    if (v?.status === 'done' && v.assetId) {
      return { assetId: v.assetId, imageUrl: v.imageUrl };
    }
  }

  return null;
}

export async function resolveLastGeneratedImageUrl(
  companyId: string,
  ig: ImageGenState,
): Promise<string | null> {
  const ref = resolveLastGeneratedImageRef(ig);
  if (!ref) return null;
  return resolveAssetImageUrl(companyId, ref.assetId, ref.imageUrl);
}
