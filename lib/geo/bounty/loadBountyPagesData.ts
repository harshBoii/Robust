import 'server-only';

import { prisma } from '@/lib/prisma';

export type BountyPageRecord = {
  id: string;
  query: string;
  status: string;
  confidence: number;
  difficulty: string | null;
  spreadPlatforms: unknown;
  aeoPage: {
    id: string;
    slug: string;
    locale: string;
    title: string | null;
    description: string | null;
    status: string;
    pageType: string;
    publishedAt: Date | null;
    canonicalUrl: string | null;
  } | null;
  contents: Array<{
    id: string;
    platform: string;
    status: string;
    title: string | null;
    publishedUrl: string | null;
    publishedAt: Date | null;
  }>;
};

export async function loadBountyPagesData(companyId: string): Promise<BountyPageRecord[]> {
  const bounties = await prisma.citationBounty.findMany({
    where: {
      companyId,
      OR: [{ aeoPageId: { not: null } }, { contents: { some: {} } }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      aeoPage: {
        select: {
          id: true,
          slug: true,
          locale: true,
          title: true,
          description: true,
          status: true,
          pageType: true,
          publishedAt: true,
          canonicalUrl: true,
        },
      },
      contents: {
        select: {
          id: true,
          platform: true,
          status: true,
          title: true,
          publishedUrl: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  return bounties.map((b) => ({
    id: b.id,
    query: b.query,
    status: b.status,
    confidence: b.confidence,
    difficulty: b.difficulty,
    spreadPlatforms: b.spreadPlatforms,
    aeoPage: b.aeoPage,
    contents: b.contents,
  }));
}
