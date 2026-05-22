import 'server-only';

import { resolveLastGeneratedImageRef } from './resolve-last-generated-image';
import type { ImageGenState } from './types';

/** Swap product reference to the last generated image (keeps subpath/step). */
export function applyLastGeneratedAsProductImage(ig: ImageGenState): ImageGenState | null {
  const ref = resolveLastGeneratedImageRef(ig);
  if (!ref) return null;

  return {
    ...ig,
    productImageAssetId: ref.assetId,
    productImageUrl: ref.imageUrl?.trim() ? ref.imageUrl.trim() : undefined,
    imageSource: 'carriedOver',
  };
}

/** Start variant gen using the last generated image as the base reference. */
export function applyLastGeneratedForVariantGen(ig: ImageGenState): ImageGenState | null {
  const carried = applyLastGeneratedAsProductImage(ig);
  if (!carried) return null;

  return {
    ...carried,
    subpath: 'variantGen',
    carryOverFromSubpath1: true,
    step: 'collectFields',
    copyCount: carried.copyCount ?? 4,
  };
}
