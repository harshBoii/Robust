import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import { runGetCitedForCompany } from '@/lib/geo/bounty/runGetCitedForCompany';
import { prisma } from '@/lib/prisma';

import {
  assertMicroserviceGap,
  recordMicroserviceRun,
  sleepMicroserviceGap,
} from './microservice-gap';
import type { BountyPageGenerationSettings, JobRunResult } from './types';
import { parseBountyPageSettings } from './validate-settings';

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export async function runSingleBountyPageJob(
  companyId: string,
  opts: { query: string; platforms: BountySpreadPlatform[]; promptId?: string | null },
): Promise<JobRunResult> {
  await assertMicroserviceGap(companyId);
  try {
    const result = await runGetCitedForCompany({
      companyId,
      query: opts.query,
      platforms: opts.platforms,
      promptId: opts.promptId ?? null,
    });
    await recordMicroserviceRun(companyId);
    return {
      status: result.success ? 'SUCCESS' : 'FAILED',
      summary: {
        bountyId: result.bountyId,
        results: result.results,
      },
      error: result.success ? undefined : 'One or more platforms failed',
    };
  } catch (err) {
    return {
      status: 'FAILED',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runBountyPagesBatchJob(
  companyId: string,
  rawSettings?: Partial<BountyPageGenerationSettings>,
): Promise<JobRunResult> {
  const settings = parseBountyPageSettings(rawSettings ?? {});

  const prompts = await prisma.prompt.findMany({
    where: {
      isActive: true,
      llmTopic: { companyId },
    },
    select: { id: true, query: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  if (prompts.length === 0) {
    return {
      status: 'SKIPPED',
      error: 'No active prompts available for bounty page generation',
    };
  }

  const count = randomInt(settings.minPages, settings.maxPages);
  const results: Array<{ query: string; bountyId?: string; success: boolean }> = [];

  for (let i = 0; i < count; i++) {
    const prompt = pickRandom(prompts);
    if (!prompt) break;

    const single = await runSingleBountyPageJob(companyId, {
      query: prompt.query,
      platforms: settings.platforms,
      promptId: prompt.id,
    });

    results.push({
      query: prompt.query,
      bountyId:
        single.summary && typeof single.summary.bountyId === 'string'
          ? single.summary.bountyId
          : undefined,
      success: single.status === 'SUCCESS',
    });

    if (single.status === 'FAILED' && results.length === 1 && count === 1) {
      return single;
    }

    if (i < count - 1) {
      await sleepMicroserviceGap();
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return {
    status: successCount > 0 ? 'SUCCESS' : 'FAILED',
    summary: { generated: results.length, successCount, results },
    error: successCount === 0 ? 'All bounty page generations failed' : undefined,
  };
}
