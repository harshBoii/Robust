import 'server-only';

import { isUserMetaOAuthToken } from '@/lib/meta/integration-token';
import { getMyAdAccounts, getMyPages, getPageInstagramUsername } from '@/lib/meta/client';
import { countActiveSessions } from '@/lib/auth/session-store';
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
  displayName: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
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
  security: {
    activeSessions: number;
  };
  meta: {
    adAccountId: string | null;
    adAccountName: string | null;
    fbPageId: string | null;
    fbPageName: string | null;
    instagramHandle: string | null;
    contextBuiltAt: string | null;
    hasBrandVoice: boolean;
    avgWinningCtr: number | null;
    hasUserOAuth: boolean;
    connectedAt: string;
    updatedAt: string;
    lastSyncedAt: string;
  } | null;
  shopify: {
    connected: boolean;
    shopDomain: string | null;
    productCount: number;
    lastSyncedAt: string | null;
    connectedAt: string | null;
  } | null;
};

async function resolveMetaExtras(
  companyId: string,
  meta: {
    adAccountId: string | null;
    fbPageId: string | null;
  },
): Promise<{
  adAccountName: string | null;
  fbPageName: string | null;
  instagramHandle: string | null;
}> {
  try {
    const [accounts, pages] = await Promise.all([
      getMyAdAccounts({ companyId }),
      getMyPages({ companyId }),
    ]);
    const adAccountName =
      meta.adAccountId != null
        ? accounts.find((a) => a.id === meta.adAccountId)?.name ?? null
        : null;
    const page = meta.fbPageId != null ? pages.find((p) => p.id === meta.fbPageId) : null;
    const fbPageName = page?.name ?? null;
    let instagramHandle: string | null = null;
    if (meta.fbPageId) {
      instagramHandle = await getPageInstagramUsername(meta.fbPageId, { companyId });
    }
    return { adAccountName, fbPageName, instagramHandle };
  } catch {
    return { adAccountName: null, fbPageName: null, instagramHandle: null };
  }
}

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
      emailVerifiedAt: true,
      twoFactorEnabled: true,
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
      shopifyShops: {
        where: { status: "installed" },
        take: 1,
        select: {
          shopDomain: true,
          updatedAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          assets: true,
          adChatSessions: true,
          adPresets: true,
          notifications: true,
          shopifyProducts: true,
        },
      },
    },
  });

  if (!company) return null;

  const { metaIntegration, shopifyShops, _count, ...rest } = company;
  const displayName = rest.userName ?? rest.name;

  let metaBlock: CompanyProfile['meta'] = null;
  if (metaIntegration) {
    const extras = await resolveMetaExtras(companyId, {
      adAccountId: metaIntegration.adAccountId,
      fbPageId: metaIntegration.fbPageId,
    });
    metaBlock = {
      adAccountId: metaIntegration.adAccountId,
      adAccountName: extras.adAccountName,
      fbPageId: metaIntegration.fbPageId,
      fbPageName: extras.fbPageName,
      instagramHandle: extras.instagramHandle,
      contextBuiltAt: metaIntegration.contextBuiltAt?.toISOString() ?? null,
      hasBrandVoice: Boolean(metaIntegration.brandVoice),
      avgWinningCtr: metaIntegration.avgWinningCtr,
      hasUserOAuth: isUserMetaOAuthToken(metaIntegration.accessToken),
      connectedAt: metaIntegration.createdAt.toISOString(),
      updatedAt: metaIntegration.updatedAt.toISOString(),
      lastSyncedAt: metaIntegration.updatedAt.toISOString(),
    };
  }

  const installedShop = shopifyShops[0] ?? null;
  let shopifyBlock: CompanyProfile['shopify'] = null;
  if (installedShop) {
    const latestProduct = await prisma.shopifyProduct.findFirst({
      where: { companyId },
      orderBy: { shopifyUpdatedAt: 'desc' },
      select: { shopifyUpdatedAt: true },
    });
    shopifyBlock = {
      connected: true,
      shopDomain: installedShop.shopDomain,
      productCount: _count.shopifyProducts,
      lastSyncedAt: latestProduct?.shopifyUpdatedAt?.toISOString() ?? null,
      connectedAt: installedShop.createdAt.toISOString(),
    };
  }

  const activeSessions = await countActiveSessions(companyId);

  return {
    ...rest,
    displayName,
    emailVerified: Boolean(rest.emailVerifiedAt),
    subscriptionCreatedAt: rest.subscriptionCreatedAt?.toISOString() ?? null,
    subscriptionUpdatedAt: rest.subscriptionUpdatedAt?.toISOString() ?? null,
    createdAt: rest.createdAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
    stats: _count,
    security: { activeSessions },
    meta: metaBlock,
    shopify: shopifyBlock,
  };
}
