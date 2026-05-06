import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.adsetPreset.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: {
      pinnedCampaign: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ presets });
}

type PostBody = {
  name?: unknown;
  isDefault?: unknown;
  dailyBudget?: unknown;
  lifetimeBudget?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  billingEvent?: unknown;
  optimizationGoal?: unknown;
  destinationType?: unknown;
  bidStrategy?: unknown;
  bidAmount?: unknown;
  isDefaultCreative?: unknown;
  pacingType?: unknown;
  promotedObject?: unknown;
  attributionSpec?: unknown;
  pinnedCampaignId?: unknown;
  bidConstraints?: unknown;
  targeting?: unknown;
};

function parseIso(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const pinnedCampaignId =
    typeof body.pinnedCampaignId === 'string' ? body.pinnedCampaignId : null;
  if (pinnedCampaignId) {
    const campaign = await prisma.metaCampaign.findFirst({
      where: {
        id: pinnedCampaignId,
        metaIntegration: { companyId: session.companyId },
      },
      select: { id: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: 'Invalid pinnedCampaignId' }, { status: 400 });
    }
  }

  const preset = await prisma.adsetPreset.create({
    data: {
      companyId: session.companyId,
      name,
      isDefault: Boolean(body.isDefault),
      dailyBudget: typeof body.dailyBudget === 'number' ? BigInt(Math.floor(body.dailyBudget)) : null,
      lifetimeBudget: typeof body.lifetimeBudget === 'number' ? BigInt(Math.floor(body.lifetimeBudget)) : null,
      startTime: parseIso(body.startTime),
      endTime: parseIso(body.endTime),
      billingEvent: typeof body.billingEvent === 'string' ? body.billingEvent : null,
      optimizationGoal: typeof body.optimizationGoal === 'string' ? body.optimizationGoal : null,
      destinationType: typeof body.destinationType === 'string' ? body.destinationType : null,
      bidStrategy: typeof body.bidStrategy === 'string' ? body.bidStrategy : null,
      bidAmount: typeof body.bidAmount === 'number' ? BigInt(Math.floor(body.bidAmount)) : null,
      isDefaultCreative: Boolean(body.isDefaultCreative),
      pacingType: typeof body.pacingType === 'string' ? body.pacingType : null,
      promotedObject: typeof body.promotedObject === 'object' && body.promotedObject ? (body.promotedObject as Prisma.InputJsonValue) : {},
      attributionSpec: Array.isArray(body.attributionSpec) ? (body.attributionSpec as Prisma.InputJsonValue) : [],
      pinnedCampaignId,
      bidConstraints: typeof body.bidConstraints === 'object' && body.bidConstraints ? (body.bidConstraints as Prisma.InputJsonValue) : {},
      targeting: typeof body.targeting === 'object' && body.targeting ? (body.targeting as Prisma.InputJsonValue) : {},
    },
  });

  return NextResponse.json({ preset });
}

