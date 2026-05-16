import { NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/app/generated/prisma/client';

import { getSession } from '@/lib/auth/session';
import { jsonSafe } from '@/lib/json-safe';
import { parseScheduleDuration } from '@/lib/meta/adset-schedule';
import { sanitizeMetaTargeting } from '@/lib/meta/targeting';
import { validateAdsetPresetRequest } from '@/lib/meta/validate-adset-preset-request';
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
      pinnedCampaign: { select: { id: true, name: true, objective: true } },
    },
  });

  return NextResponse.json({ presets: jsonSafe(presets) });
}

type PostBody = {
  name?: unknown;
  isDefault?: unknown;
  dailyBudget?: unknown;
  lifetimeBudget?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  scheduleDuration?: unknown;
  scheduleCustomEnd?: unknown;
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

  const scheduleDuration = parseScheduleDuration(body.scheduleDuration);
  const scheduleCustomEnd = parseIso(body.scheduleCustomEnd);
  if (scheduleDuration === 'custom' && !scheduleCustomEnd) {
    return NextResponse.json({ error: 'Custom end date is required when duration is custom' }, { status: 400 });
  }
  if (scheduleCustomEnd && scheduleDuration !== 'custom') {
    return NextResponse.json({ error: 'scheduleCustomEnd is only valid with custom duration' }, { status: 400 });
  }

  const metaValidation = await validateAdsetPresetRequest(session.companyId, body);
  if (!metaValidation.ok) {
    return NextResponse.json({ error: metaValidation.error }, { status: 400 });
  }

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
      startTime: scheduleDuration ? null : parseIso(body.startTime),
      endTime: scheduleDuration ? null : parseIso(body.endTime),
      scheduleDuration,
      scheduleCustomEnd: scheduleDuration === 'custom' ? scheduleCustomEnd : null,
      billingEvent: metaValidation.fields.billingEvent,
      optimizationGoal: metaValidation.fields.optimizationGoal,
      destinationType: typeof body.destinationType === 'string' ? body.destinationType : null,
      bidStrategy: typeof body.bidStrategy === 'string' ? body.bidStrategy : null,
      bidAmount: typeof body.bidAmount === 'number' ? BigInt(Math.floor(body.bidAmount)) : null,
      isDefaultCreative: Boolean(body.isDefaultCreative),
      pacingType: typeof body.pacingType === 'string' ? body.pacingType : null,
      promotedObject: metaValidation.fields.promotedObject as Prisma.InputJsonValue,
      attributionSpec: Array.isArray(body.attributionSpec) ? (body.attributionSpec as Prisma.InputJsonValue) : [],
      pinnedCampaignId,
      bidConstraints: typeof body.bidConstraints === 'object' && body.bidConstraints ? (body.bidConstraints as Prisma.InputJsonValue) : {},
      targeting: (sanitizeMetaTargeting(body.targeting) ?? {}) as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ preset: jsonSafe(preset) });
}

