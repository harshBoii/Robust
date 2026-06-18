import 'server-only';

import { AccessStatus, SubscriptionStatus } from '@/app/generated/prisma/client';

import { prisma } from '@/lib/prisma';

export type AccessRequestRow = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  email: string | null;
  userName: string | null;
  logoUrl: string | null;
  accessStatus: AccessStatus;
  accessRequestedAt: string | null;
  accessReviewedAt: string | null;
  accessReviewNote: string | null;
  onboardingPlan: unknown;
  metaConnected: boolean;
  shopifyConnected: boolean;
  industry: string | null;
  oneLiner: string | null;
};

function serializeRow(row: {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  email: string | null;
  userName: string | null;
  logoUrl: string | null;
  accessStatus: AccessStatus;
  accessRequestedAt: Date | null;
  accessReviewedAt: Date | null;
  accessReviewNote: string | null;
  onboardingPlan: unknown;
  metaIntegration: { id: string } | null;
  shopifyShops: { id: string }[];
  brandEntity: { industry: string | null; oneLiner: string | null } | null;
}): AccessRequestRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    email: row.email,
    userName: row.userName,
    logoUrl: row.logoUrl,
    accessStatus: row.accessStatus,
    accessRequestedAt: row.accessRequestedAt?.toISOString() ?? null,
    accessReviewedAt: row.accessReviewedAt?.toISOString() ?? null,
    accessReviewNote: row.accessReviewNote,
    onboardingPlan: row.onboardingPlan,
    metaConnected: Boolean(row.metaIntegration),
    shopifyConnected: row.shopifyShops.length > 0,
    industry: row.brandEntity?.industry ?? null,
    oneLiner: row.brandEntity?.oneLiner ?? null,
  };
}

const rowSelect = {
  id: true,
  name: true,
  slug: true,
  domain: true,
  email: true,
  userName: true,
  logoUrl: true,
  accessStatus: true,
  accessRequestedAt: true,
  accessReviewedAt: true,
  accessReviewNote: true,
  onboardingPlan: true,
  metaIntegration: { select: { id: true } },
  shopifyShops: {
    where: { status: 'installed' as const },
    select: { id: true },
    take: 1,
  },
  brandEntity: { select: { industry: true, oneLiner: true } },
} as const;

export async function listPendingAccessRequests(): Promise<AccessRequestRow[]> {
  const rows = await prisma.company.findMany({
    where: {
      accessStatus: AccessStatus.PENDING,
      accessRequestedAt: { not: null },
    },
    orderBy: { accessRequestedAt: 'desc' },
    select: rowSelect,
  });
  return rows.map(serializeRow);
}

export async function listRecentlyReviewedAccessRequests(
  limit = 20,
): Promise<AccessRequestRow[]> {
  const rows = await prisma.company.findMany({
    where: {
      accessStatus: { in: [AccessStatus.APPROVED, AccessStatus.REJECTED] },
      accessReviewedAt: { not: null },
    },
    orderBy: { accessReviewedAt: 'desc' },
    take: limit,
    select: rowSelect,
  });
  return rows.map(serializeRow);
}

export async function approveAccessRequest(companyId: string) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      accessStatus: AccessStatus.APPROVED,
      accessReviewedAt: new Date(),
      subscriptionStatus: SubscriptionStatus.ACTIVE,
    },
    select: { id: true, accessStatus: true },
  });
}

export async function rejectAccessRequest(companyId: string, note?: string) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      accessStatus: AccessStatus.REJECTED,
      accessReviewedAt: new Date(),
      accessReviewNote: note?.trim() || null,
    },
    select: { id: true, accessStatus: true },
  });
}
