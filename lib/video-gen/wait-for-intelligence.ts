import 'server-only';

import { prisma } from '@/lib/prisma';

const POLL_MS = 3000;
const MAX_WAIT_MS = 10 * 60 * 1000;

export async function waitForIntelligenceReady(
  companyId: string,
  assetIds: string[],
): Promise<void> {
  if (!assetIds.length) return;

  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const assets = await prisma.asset.findMany({
      where: { id: { in: assetIds }, companyId },
      select: { id: true, intelligenceStatus: true },
    });

    const failed = assets.some((a) => a.intelligenceStatus === 'FAILED');
    if (failed) {
      throw new Error('Asset intelligence analysis failed for one or more ads.');
    }

    const allReady = assets.length === assetIds.length && assets.every((a) => a.intelligenceStatus === 'READY');
    if (allReady) return;

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error('Timed out waiting for asset intelligence analysis.');
}
