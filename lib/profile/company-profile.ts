import 'server-only';

import { isUserMetaOAuthToken } from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';

export type CompanyProfile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  domain: string | null;
  email: string | null;
  userName: string | null;
  subscriptionStatus: string;
  subscriptionCreatedAt: string | null;
  subscriptionUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: {
    assets: number;
    adChatSessions: number;
    adPresets: number;
    notifications: number;
  };
  meta: {
    adAccountId: string | null;
    fbPageId: string | null;
    contextBuiltAt: string | null;
    hasBrandVoice: boolean;
    avgWinningCtr: number | null;
    hasUserOAuth: boolean;
    connectedAt: string;
    updatedAt: string;
  } | null;
};

export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      website: true,
      domain: true,
      email: true,
      userName: true,
      subscriptionStatus: true,
      subscriptionCreatedAt: true,
      subscriptionUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
      metaIntegration: {
        select: {
          adAccountId: true,
          fbPageId: true,
          contextBuiltAt: true,
          brandVoice: true,
          avgWinningCtr: true,
          accessToken: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          assets: true,
          adChatSessions: true,
          adPresets: true,
          notifications: true,
        },
      },
    },
  });

  if (!company) return null;

  const { metaIntegration, _count, ...rest } = company;

  return {
    ...rest,
    subscriptionCreatedAt: rest.subscriptionCreatedAt?.toISOString() ?? null,
    subscriptionUpdatedAt: rest.subscriptionUpdatedAt?.toISOString() ?? null,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
    stats: _count,
    meta: metaIntegration
      ? {
          adAccountId: metaIntegration.adAccountId,
          fbPageId: metaIntegration.fbPageId,
          contextBuiltAt: metaIntegration.contextBuiltAt?.toISOString() ?? null,
          hasBrandVoice: Boolean(metaIntegration.brandVoice),
          avgWinningCtr: metaIntegration.avgWinningCtr,
          hasUserOAuth: isUserMetaOAuthToken(metaIntegration.accessToken),
          connectedAt: metaIntegration.createdAt.toISOString(),
          updatedAt: metaIntegration.updatedAt.toISOString(),
        }
      : null,
  };
}
