import 'server-only';

import { callProcessFromApiBatch } from '@/lib/asset-intelligence/microservice-client';
import { linkWinningAdCreatives } from '@/lib/asset-intelligence/link-winning-creatives';
import { getIntelligenceResultsForAssets } from '@/lib/asset-intelligence/intelligence-results';
import { getTopWinningAssets } from '@/lib/asset-intelligence/top-winning';
import { prisma } from '@/lib/prisma';

import { synthesizeBriefFromIntelligence } from './synthesize-brief';
import { waitForIntelligenceReady } from './wait-for-intelligence';

export type TopAdsPipelineResult = {
  assetIds: string[];
  intelligenceBrief: string;
};

export async function runTopAdsIntelligencePipeline(
  companyId: string,
): Promise<TopAdsPipelineResult> {
  await linkWinningAdCreatives(companyId);

  const topAssets = await getTopWinningAssets(companyId);
  const assetIds = topAssets.map((a) => a.assetId);

  if (!assetIds.length) {
    throw new Error(
      'No top-performing video ads found. Link winning creatives on Profile → Analyze ads first.',
    );
  }

  await prisma.asset.updateMany({
    where: { id: { in: assetIds }, companyId },
    data: { intelligenceStatus: 'PROCESSING' },
  });

  await callProcessFromApiBatch(
    topAssets.map((a) => ({ assetId: a.assetId, mediaType: a.mediaType })),
  );

  await waitForIntelligenceReady(companyId, assetIds);

  const rows = await getIntelligenceResultsForAssets(companyId, assetIds);
  const intelligenceBrief = await synthesizeBriefFromIntelligence(rows);

  return { assetIds, intelligenceBrief };
}

export async function runSingleAssetIntelligence(
  companyId: string,
  assetId: string,
): Promise<void> {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId, assetType: 'VIDEO' },
    select: { id: true, assetType: true, intelligenceStatus: true },
  });

  if (!asset) throw new Error('Video asset not found.');

  if (asset.intelligenceStatus === 'READY') return;

  await prisma.asset.update({
    where: { id: assetId },
    data: { intelligenceStatus: 'PROCESSING' },
  });

  await callProcessFromApiBatch([{ assetId, mediaType: 'VIDEO' }]);
  await waitForIntelligenceReady(companyId, [assetId]);
}
