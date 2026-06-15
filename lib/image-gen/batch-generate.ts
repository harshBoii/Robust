import 'server-only';

import { handleUserFacingLlmError } from '@/lib/assistant/user-facing-llm-error';

import { generateImage } from './generate-image';
import { buildSeedreamContextFromImageGen } from './seedream-prompt-generator';
import { storeGeneratedImage } from './store-generated';
import type { ImageGenState, ImageGenVariant } from './types';

export type BatchGenerateInput = {
  companyId: string;
  sessionId: string;
  referenceImageUrl: string;
  /** Company logo URL, appended as an extra reference image after the product image. */
  logoUrl?: string | null;
  aspectRatio?: string | null;
  imageArtistId?: string | null;
  imageQuality?: ImageGenState['imageQuality'];
  variants: ImageGenVariant[];
  indices?: number[];
  /** Full image-gen state for Seedream prompt refinement. */
  imageGenState?: ImageGenState;
};

export type BatchGenerateResult = {
  variants: ImageGenVariant[];
  succeeded: number;
  failed: number;
};

async function generateOneWithRetry(input: {
  companyId: string;
  sessionId: string;
  referenceImageUrl: string;
  logoUrl?: string | null;
  aspectRatio?: string | null;
  imageArtistId?: string | null;
  imageQuality?: ImageGenState['imageQuality'];
  variant: ImageGenVariant;
  imageGenState?: ImageGenState;
}): Promise<ImageGenVariant> {
  const refUrls = [input.referenceImageUrl, ...(input.logoUrl ? [input.logoUrl] : [])];
  const run = async () => {
    const gen = await generateImage({
      prompt: input.variant.prompt,
      referenceImageUrls: refUrls,
      aspectRatio: input.aspectRatio,
      imageArtistId: input.imageArtistId,
      quality: input.imageQuality,
      seedreamContext: input.imageGenState
        ? buildSeedreamContextFromImageGen(
            input.imageGenState,
            input.variant.prompt,
            refUrls.length,
          )
        : undefined,
    });
    const stored = await storeGeneratedImage({
      companyId: input.companyId,
      sessionId: input.sessionId,
      imageBase64: gen.imageBase64,
      title: input.variant.ideaLabel,
      label: input.variant.ideaLabel,
    });
    return {
      ...input.variant,
      assetId: stored.assetId,
      imageUrl: stored.imageUrl,
      status: 'done' as const,
      error: undefined,
    };
  };

  try {
    return await run();
  } catch (firstErr) {
    try {
      return await run();
    } catch (secondErr) {
      return {
        ...input.variant,
        status: 'failed' as const,
        error: handleUserFacingLlmError('image-gen/batch-generate', secondErr),
      };
    }
  }
}

export async function batchGenerateVariants(
  input: BatchGenerateInput,
): Promise<BatchGenerateResult> {
  const indices =
    input.indices ??
    input.variants.map((v, i) => (v.status !== 'done' ? i : -1)).filter((i) => i >= 0);

  const variants = [...input.variants];

  const tasks = indices.map(async (index) => {
    const variant = variants[index];
    if (!variant?.prompt) return { index, variant };
    const updated = await generateOneWithRetry({
      companyId: input.companyId,
      sessionId: input.sessionId,
      referenceImageUrl: input.referenceImageUrl,
      logoUrl: input.logoUrl,
      aspectRatio: input.aspectRatio,
      imageArtistId: input.imageArtistId,
      imageQuality: input.imageQuality,
      variant,
      imageGenState: input.imageGenState,
    });
    return { index, variant: updated };
  });

  const results = await Promise.all(tasks);
  for (const { index, variant } of results) {
    variants[index] = variant;
  }

  const succeeded = variants.filter((v) => v.status === 'done').length;
  const failed = variants.filter((v) => v.status === 'failed').length;

  return { variants, succeeded, failed };
}
