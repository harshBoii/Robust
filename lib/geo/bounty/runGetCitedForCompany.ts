import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { syncBountyRevenueForCompany } from '@/lib/geo/radar/bountySync';
import { huntBountyForCompany } from '@/lib/geo/bounty/huntForCompany';
import { huntSocialForCompany } from '@/lib/geo/bounty/huntSocialForCompany';
import { parseSpreadPlatforms } from '@/lib/geo/bounty/spread-platforms';

export type GetCitedPlatformResult = {
  platform: BountySpreadPlatform;
  success: boolean;
  contentId?: string;
  aeoPageId?: string | null;
  error?: string;
};

export type RunGetCitedResult = {
  success: boolean;
  bountyId: string;
  results: GetCitedPlatformResult[];
};

export async function runGetCitedForCompany(opts: {
  companyId: string;
  query: string;
  platforms: BountySpreadPlatform[];
  promptId?: string | null;
}): Promise<RunGetCitedResult> {
  const query = opts.query.trim();
  if (!query) {
    throw new Error('query is required');
  }

  const platforms = parseSpreadPlatforms(opts.platforms);
  if (platforms.length === 0) {
    throw new Error('At least one platform must be selected');
  }

  const bounty = await prisma.citationBounty.create({
    data: {
      companyId: opts.companyId,
      query,
      pageType: 'USE_CASE',
      confidence: 50,
      status: 'OPEN',
      spreadPlatforms: platforms,
    },
    select: { id: true },
  });

  await syncBountyRevenueForCompany(prisma, opts.companyId);

  const settled = await Promise.allSettled(
    platforms.map(async (platform): Promise<GetCitedPlatformResult> => {
      try {
        if (platform === 'WEBSITE_BLOG') {
          const { aeoPageId } = await huntBountyForCompany({
            companyId: opts.companyId,
            bountyId: bounty.id,
          });
          return { platform, success: true, aeoPageId };
        }
        const { contentId } = await huntSocialForCompany({
          companyId: opts.companyId,
          bountyId: bounty.id,
          platform,
        });
        return { platform, success: true, contentId };
      } catch (err) {
        return {
          platform,
          success: false,
          error: err instanceof Error ? err.message : 'Platform generation failed',
        };
      }
    }),
  );

  const results: GetCitedPlatformResult[] = settled.map((entry, index) => {
    const platform = platforms[index]!;
    if (entry.status === 'fulfilled') return entry.value;
    return {
      platform,
      success: false,
      error: entry.reason instanceof Error ? entry.reason.message : 'Platform request failed',
    };
  });

  const anySuccess = results.some((r) => r.success);

  if (anySuccess && opts.promptId) {
    const ownedPrompt = await prisma.prompt.findFirst({
      where: {
        id: opts.promptId,
        llmTopic: { companyId: opts.companyId },
      },
      select: { id: true },
    });
    if (ownedPrompt) {
      await prisma.prompt.update({
        where: { id: opts.promptId },
        data: { ishunted: true },
      });
    }
  }

  return {
    success: anySuccess,
    bountyId: bounty.id,
    results,
  };
}
