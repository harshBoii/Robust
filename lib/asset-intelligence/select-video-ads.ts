import 'server-only';

import { prisma } from '@/lib/prisma';

import {
  listMetaAdsBySignal,
  type WinningMetaAdRow,
  WinnersQueryError,
} from './winners';

export const ANALYSIS_SIGNAL_PRIORITY = ['WINNER', 'FATIGUE', 'UNDERPERFORMER'] as const;

export const MAX_VIDEOS_FOR_ANALYSIS = 3;

const SCAN_PER_SIGNAL = 60;

export type MetaAdCandidateRow = WinningMetaAdRow & {
  statusSignal: string;
};

/** Ads ordered by signal tier (WINNER → FATIGUE → UNDERPERFORMER), spend desc within each tier. */
export async function listMetaAdCandidatesBySignalPriority(
  companyId: string,
  limitPerSignal = SCAN_PER_SIGNAL,
): Promise<MetaAdCandidateRow[]> {
  const rows: MetaAdCandidateRow[] = [];
  const seenAdIds = new Set<string>();

  for (const signal of ANALYSIS_SIGNAL_PRIORITY) {
    const batch = await listMetaAdsBySignal(companyId, signal, limitPerSignal);
    for (const row of batch) {
      if (seenAdIds.has(row.metaAdId)) continue;
      seenAdIds.add(row.metaAdId);
      rows.push({ ...row, statusSignal: signal });
    }
  }

  return rows;
}

/**
 * Pick up to `maxCount` gallery VIDEO assets for analysis.
 * Skips IMAGE/DOCUMENT. Fails only when zero videos are available.
 */
export async function pickVideoAssetIdsForAnalysis(
  companyId: string,
  maxCount = MAX_VIDEOS_FOR_ANALYSIS,
): Promise<string[]> {
  const candidates = await listMetaAdCandidatesBySignalPriority(companyId);

  const linkedAssetIds: string[] = [];
  const seenAssets = new Set<string>();

  for (const c of candidates) {
    if (!c.assetId || !c.hasLinkedAsset || seenAssets.has(c.assetId)) continue;
    seenAssets.add(c.assetId);
    linkedAssetIds.push(c.assetId);
  }

  if (!linkedAssetIds.length) {
    throw new WinnersQueryError(
      'No video ads with linked gallery assets found. Run “Link creatives” after refreshing the dashboard, or ensure winning/fatigue/underperformer ads include video creatives.',
      400,
    );
  }

  const videoAssets = await prisma.asset.findMany({
    where: {
      companyId,
      id: { in: linkedAssetIds },
      assetType: 'VIDEO',
    },
    select: { id: true },
  });

  const videoIdSet = new Set(videoAssets.map((a) => a.id));
  const ordered: string[] = [];
  const picked = new Set<string>();

  for (const id of linkedAssetIds) {
    if (!videoIdSet.has(id) || picked.has(id)) continue;
    picked.add(id);
    ordered.push(id);
    if (ordered.length >= maxCount) break;
  }

  if (!ordered.length) {
    throw new WinnersQueryError(
      'No video gallery assets found for analysis (image/document ads are skipped). Link video winning ads from Meta first.',
      400,
    );
  }

  return ordered;
}
