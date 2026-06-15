import 'server-only';

import { randomUUID } from 'crypto';

import { getArtistStylePrompt } from '@/lib/image-gen/artist-styles';
import { generateImage } from '@/lib/image-gen/generate-image';
import { buildBrandDnaPromptBlock, composeBrandTone, loadBrandDnaContext } from '@/lib/image-gen/load-brand-dna';
import { storeGeneratedImage } from '@/lib/image-gen/store-generated';
import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/config';
import { prisma } from '@/lib/prisma';
import { loadGroupsForBulk } from '@/lib/chats/load-groups';
import type { WorkflowState } from '@/lib/chats/types';

import { decideStaticBrief } from './decide-campaign-adset';

export type GenerateStaticsResult = {
  state: WorkflowState;
  assetIds: string[];
};

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
  const promptParts = [
    brief.prompt,
    brandDnaBlock ? `Brand DNA:\n${brandDnaBlock}` : null,
    artistStyle ? `Style: ${artistStyle}` : null,
    'High quality Meta ad static, no watermark, commercial photography.',
  ].filter(Boolean);

  const prompt = promptParts.join('\n\n');
  const count = Math.min(4, Math.max(1, brief.variantCount));
  const assetIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const { imageBase64 } = await generateImage({
      prompt: count > 1 ? `${prompt}\n\nVariation ${i + 1} of ${count}.` : prompt,
      aspectRatio: brief.aspectRatio,
      imageArtistId: input.config.defaultArtistId,
    });

    const stored = await storeGeneratedImage({
      companyId: input.companyId,
      sessionId: input.sessionId,
      imageBase64,
      title: brief.campaignTheme ?? `Auto ad ${i + 1}`,
      label: brief.campaignTheme ?? input.userText.slice(0, 60),
    });
    assetIds.push(stored.assetId);
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

  const { groups } = await loadGroupsForBulk(bulk.id, input.companyId, {
    runContentAnalyze: true,
  });

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
