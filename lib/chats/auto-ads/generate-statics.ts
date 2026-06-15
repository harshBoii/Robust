import 'server-only';

import { randomUUID } from 'crypto';

import { getArtistStylePrompt } from '@/lib/image-gen/artist-styles';
import { generateImage } from '@/lib/image-gen/generate-image';
import { buildBrandDnaPromptBlock, composeBrandTone, loadBrandDnaContext } from '@/lib/image-gen/load-brand-dna';
import type { SeedreamPromptContext } from '@/lib/image-gen/seedream-prompt-generator';
import { appendLogoRef, resolveCompanyLogoUrl } from '@/lib/image-gen/resolve-company-logo';
import { storeGeneratedImage } from '@/lib/image-gen/store-generated';
import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/config';
import { prisma } from '@/lib/prisma';
import { buildAutoStaticGroups } from '@/lib/chats/expand-groups-one-ad-per-asset';
import type { WorkflowState } from '@/lib/chats/types';

import { buildAutoStaticPrompt } from './build-auto-static-prompt';
import { decideStaticBrief } from './decide-campaign-adset';
import { pickRandomShopifyProductRefs, type ShopifyProductRef } from './pick-shopify-product-refs';

export type GenerateStaticsResult = {
  state: WorkflowState;
  assetIds: string[];
};

async function generateOneStatic(input: {
  companyId: string;
  sessionId: string;
  briefPrompt: string;
  brandDnaBlock: string | null;
  brandTone: string | null;
  artistStyle: string | null;
  aspectRatio: string;
  imageArtistId: string;
  index: number;
  count: number;
  title: string;
  label: string;
  productRef?: ShopifyProductRef | null;
  logoUrl?: string | null;
}): Promise<string | null> {
  try {
    const prompt = buildAutoStaticPrompt({
      briefPrompt: input.briefPrompt,
      brandDnaBlock: input.brandDnaBlock,
      brandTone: input.brandTone,
      artistStyle: input.artistStyle,
      aspectRatio: input.aspectRatio,
      productRef: input.productRef
        ? { title: input.productRef.title, description: input.productRef.description }
        : null,
      hasLogo: Boolean(input.logoUrl?.trim()),
      variationIndex: input.index,
      variationCount: input.count,
    });

    const referenceImageUrls = input.productRef
      ? appendLogoRef([input.productRef.imageUrl], input.logoUrl)
      : undefined;

    const { imageBase64 } = await generateImage({
      prompt,
      referenceImageUrls,
      aspectRatio: input.aspectRatio,
      imageArtistId: input.imageArtistId,
      seedreamContext: {
        draftPrompt: prompt,
        artistStyle: input.artistStyle,
        brandDnaPromptBlock: input.brandDnaBlock,
        brandTone: input.brandTone,
        aspectRatio: input.aspectRatio,
        referenceImageCount: referenceImageUrls?.length ?? 0,
      } satisfies SeedreamPromptContext,
    });

    const stored = await storeGeneratedImage({
      companyId: input.companyId,
      sessionId: input.sessionId,
      imageBase64,
      title: input.count > 1 ? `${input.title} ${input.index + 1}` : input.title,
      label: input.label,
    });

    return stored.assetId;
  } catch (err) {
    console.error('[auto-ads:generate-statics] variant failed', {
      index: input.index,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function generateAutoAdsStatics(input: {
  companyId: string;
  sessionId: string;
  userText: string;
  config: MetaAdsAutoConfigData;
  state: WorkflowState;
}): Promise<GenerateStaticsResult> {
  const ctx = await loadBrandDnaContext(input.companyId);
  const brandDnaBlock = ctx ? buildBrandDnaPromptBlock(ctx) : null;
  const brandTone = ctx ? composeBrandTone(ctx.communicationDna, ctx.brandEntity) : null;
  const brief = await decideStaticBrief({
    userText: input.userText,
    brandDnaBlock,
    brandName: ctx?.brandEntity.canonicalName ?? null,
  });

  const artistStyle = getArtistStylePrompt(input.config.defaultArtistId);
  const count = Math.min(5, Math.max(1, brief.variantCount));
  const title = brief.campaignTheme ?? 'Auto ad';
  const label = brief.campaignTheme ?? input.userText.slice(0, 60);

  const [productRefs, logoUrl] = await Promise.all([
    pickRandomShopifyProductRefs(input.companyId, count),
    resolveCompanyLogoUrl(input.companyId),
  ]);

  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      generateOneStatic({
        companyId: input.companyId,
        sessionId: input.sessionId,
        briefPrompt: brief.prompt,
        brandDnaBlock,
        brandTone,
        artistStyle,
        aspectRatio: brief.aspectRatio,
        imageArtistId: input.config.defaultArtistId,
        index: i,
        count,
        title,
        label,
        productRef: productRefs[i] ?? null,
        logoUrl,
      }),
    ),
  );

  const assetIds = results.filter((id): id is string => Boolean(id));

  if (assetIds.length === 0) {
    throw new Error('Failed to generate any ad statics. Try again or check image generation settings.');
  }

  const bulk = await prisma.bulkUpload.create({
    data: {
      companyId: input.companyId,
      name: `Auto · ${brief.campaignTheme ?? input.userText.slice(0, 40)} · ${new Date().toLocaleString()}`,
      status: 'READY',
    },
  });

  await prisma.asset.updateMany({
    where: { id: { in: assetIds }, companyId: input.companyId },
    data: { bulkUploadId: bulk.id },
  });

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds }, companyId: input.companyId },
    select: {
      id: true,
      title: true,
      filename: true,
      assetType: true,
      bulkUploadId: true,
      assetBucketId: true,
      thumbnailUrl: true,
      playbackUrl: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const groups = buildAutoStaticGroups(assets, brief.campaignTheme);

  const nextState: WorkflowState = {
    ...input.state,
    bulkUploadId: bulk.id,
    assetIds,
    groups,
    tone: brandTone ?? input.state.tone,
    intentNotes: input.state.intentNotes ?? input.userText,
  };

  return { state: nextState, assetIds };
}

export function newAutoPipelineRunId(): string {
  return randomUUID();
}
