import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metaIntegration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: {
      id: true,
      adAccountId: true,
      fbPageId: true,
      contextBuiltAt: true,
    },
  });

  const rules = await prisma.adAutomationRule.findMany({
    where: { companyId: session.companyId },
    orderBy: { ruleType: 'asc' },
    select: {
      id: true,
      ruleType: true,
      isEnabled: true,
      threshold: true,
      window: true,
      requiresApproval: true,
      lastTriggeredAt: true,
      updatedAt: true,
    },
  });

  const notifications = await prisma.notification.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      isRead: true,
      readAt: true,
      createdAt: true,
      eventId: true,
    },
  });

  // Fetch all ads belonging to this integration to scope metric queries.
  const ads = metaIntegration
    ? await prisma.metaAd.findMany({
        where: { metaIntegrationId: metaIntegration.id },
        select: { metaAdId: true },
      })
    : [];

  const adIds = ads.map((a) => a.metaAdId);

  const metrics =
    metaIntegration && adIds.length > 0
      ? await prisma.metaAdMetrics.findMany({
          where: { metaAdId: { in: adIds } },
          orderBy: { recordedAt: 'desc' },
          take: 3000,
          select: {
            id: true,
            metaCampaignId: true,
            metaAdId: true,
            impressions: true,
            clicks: true,
            ctr: true,
            spend: true,
            cpc: true,
            roas: true,
            hookRate: true,
            daysRunning: true,
            statusSignal: true,
            actions: true,
            datePreset: true,
            recordedAt: true,
          },
        })
      : [];

  return NextResponse.json({
    metaIntegration,
    metrics,
    rules,
    notifications,
  });
}

