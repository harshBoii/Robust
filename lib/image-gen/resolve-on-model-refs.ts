import 'server-only';

import { prisma } from '@/lib/prisma';

import {
  findBackground,
  findModel,
  findPose,
  type CatalogItem,
} from './catalog';
import type { ImageGenState } from './types';

export type OnModelRef = {
  label: string;
  /** Fetchable URL for OpenAI / R2 */
  imageUrl: string;
  source: 'catalog' | 'custom';
};

export type OnModelRefs = {
  product: OnModelRef;
  model: OnModelRef;
  background: OnModelRef;
  pose: OnModelRef;
};

async function assetRef(
  companyId: string,
  assetId: string,
  fallbackLabel: string,
): Promise<OnModelRef | null> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId },
    select: { thumbnailUrl: true, title: true },
  });
  if (!asset?.thumbnailUrl) return null;
  return {
    label: asset.title ?? fallbackLabel,
    imageUrl: asset.thumbnailUrl,
    source: 'custom',
  };
}

function catalogRef(item: CatalogItem): OnModelRef {
  return {
    label: item.label,
    imageUrl: item.imageUrl,
    source: 'catalog',
  };
}

export async function resolveModelRef(
  companyId: string,
  ig: ImageGenState,
): Promise<OnModelRef | null> {
  if (ig.customModelAssetId) {
    return assetRef(companyId, ig.customModelAssetId, 'Custom model');
  }
  if (ig.customModelImageUrl) {
    return { label: 'Custom model', imageUrl: ig.customModelImageUrl, source: 'custom' };
  }
  const item = ig.selectedModelId ? findModel(ig.selectedModelId) : undefined;
  return item ? catalogRef(item) : null;
}

export async function resolveBackgroundRef(
  companyId: string,
  ig: ImageGenState,
): Promise<OnModelRef | null> {
  if (ig.customBackgroundAssetId) {
    return assetRef(companyId, ig.customBackgroundAssetId, 'Custom background');
  }
  if (ig.customBackgroundImageUrl) {
    return {
      label: 'Custom background',
      imageUrl: ig.customBackgroundImageUrl,
      source: 'custom',
    };
  }
  const item = ig.selectedBackgroundId ? findBackground(ig.selectedBackgroundId) : undefined;
  return item ? catalogRef(item) : null;
}

export async function resolvePoseRef(
  companyId: string,
  ig: ImageGenState,
): Promise<OnModelRef | null> {
  if (ig.customPoseAssetId) {
    return assetRef(companyId, ig.customPoseAssetId, 'Custom pose');
  }
  if (ig.customPoseImageUrl) {
    return { label: 'Custom pose', imageUrl: ig.customPoseImageUrl, source: 'custom' };
  }
  const item = ig.selectedPoseId ? findPose(ig.selectedPoseId) : undefined;
  return item ? catalogRef(item) : null;
}

/** Ordered reference images for composite: product, model, background, pose. */
export async function resolveOnModelReferenceUrls(
  companyId: string,
  productImageUrl: string,
  ig: ImageGenState,
): Promise<{ urls: string[]; refs: OnModelRefs }> {
  const [model, background, pose] = await Promise.all([
    resolveModelRef(companyId, ig),
    resolveBackgroundRef(companyId, ig),
    resolvePoseRef(companyId, ig),
  ]);

  if (!model || !background || !pose) {
    throw new Error('Model, background, and pose are all required');
  }

  const product: OnModelRef = {
    label: 'Product',
    imageUrl: productImageUrl,
    source: 'custom',
  };

  const refs: OnModelRefs = { product, model, background, pose };
  return {
    urls: [product.imageUrl, model.imageUrl, background.imageUrl, pose.imageUrl],
    refs,
  };
}
