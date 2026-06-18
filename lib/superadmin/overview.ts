import 'server-only';

import { AccessStatus } from '@/app/generated/prisma/client';

import { prisma } from '@/lib/prisma';
import type { CompanyOverviewRow, SuperadminOverview } from '@/lib/superadmin/overview-types';

export type { CompanyOverviewRow, SuperadminOverview };

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function getSuperadminOverview(): Promise<SuperadminOverview> {
  const now = new Date();

  const [statusGroups, signupDates, companies] = await Promise.all([
    prisma.company.groupBy({
      by: ['accessStatus'],
      _count: { _all: true },
    }),
    prisma.company.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.company.findMany({
      where: { accessStatus: AccessStatus.APPROVED },
      select: {
        id: true,
        name: true,
        userName: true,
        email: true,
        domain: true,
        logoUrl: true,
        createdAt: true,
        accessStatus: true,
        subscriptionStatus: true,
        metaIntegration: { select: { id: true } },
        shopifyShops: {
          where: { status: 'installed' },
          select: { id: true },
          take: 1,
        },
        brandEntity: { select: { industry: true, category: true } },
        authSessions: {
          where: { revokedAt: null, expiresAt: { gt: now } },
          select: { lastSeenAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pendingRequests =
    statusGroups.find((g) => g.accessStatus === AccessStatus.PENDING)?._count._all ?? 0;

  const accessStatus = statusGroups.map((g) => ({
    status: g.accessStatus,
    count: g._count._all,
  }));

  const weekBuckets: { label: string; weekStart: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = startOfWeek(new Date(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    weekBuckets.push({
      label: weekLabel(weekStart),
      weekStart: weekStart.toISOString().slice(0, 10),
      count: 0,
    });
  }

  for (const row of signupDates) {
    const key = startOfWeek(row.createdAt).toISOString().slice(0, 10);
    const bucket = weekBuckets.find((b) => b.weekStart === key);
    if (bucket) bucket.count += 1;
  }

  const rows: CompanyOverviewRow[] = companies.map((c) => {
    const lastSeen = c.authSessions.reduce<Date | null>((max, s) => {
      if (!max || s.lastSeenAt > max) return s.lastSeenAt;
      return max;
    }, null);

    return {
      id: c.id,
      name: c.name,
      userName: c.userName,
      email: c.email,
      domain: c.domain,
      logoUrl: c.logoUrl,
      createdAt: c.createdAt.toISOString(),
      accessStatus: c.accessStatus,
      subscriptionStatus: c.subscriptionStatus,
      industry: c.brandEntity?.industry ?? null,
      category: c.brandEntity?.category ?? null,
      metaConnected: Boolean(c.metaIntegration),
      shopifyConnected: c.shopifyShops.length > 0,
      activeSessionCount: c.authSessions.length,
      lastSeenAt: lastSeen?.toISOString() ?? null,
    };
  });

  const approvedCompanies = rows.length;
  const activeSessionsNow = rows.reduce((sum, r) => sum + r.activeSessionCount, 0);
  const companiesActiveNow = rows.filter((r) => r.activeSessionCount > 0).length;
  const metaConnected = rows.filter((r) => r.metaConnected).length;
  const shopifyConnected = rows.filter((r) => r.shopifyConnected).length;

  const pct = (n: number, total: number) =>
    total === 0 ? 0 : Math.round((n / total) * 100);

  return {
    kpis: {
      approvedCompanies,
      pendingRequests,
      activeSessionsNow,
      companiesActiveNow,
      metaAdoptionPct: pct(metaConnected, approvedCompanies),
      shopifyAdoptionPct: pct(shopifyConnected, approvedCompanies),
    },
    charts: {
      accessStatus,
      signupsByWeek: weekBuckets.map(({ label, count }) => ({ label, count })),
      integrationAdoption: [
        {
          name: 'Meta',
          connected: metaConnected,
          total: approvedCompanies,
          pct: pct(metaConnected, approvedCompanies),
        },
        {
          name: 'Shopify',
          connected: shopifyConnected,
          total: approvedCompanies,
          pct: pct(shopifyConnected, approvedCompanies),
        },
      ],
    },
    companies: rows,
  };
}
