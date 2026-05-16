import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { jsonSafe } from '@/lib/json-safe';
import { parseScheduleDuration } from '@/lib/meta/adset-schedule';
import { sanitizeMetaTargeting } from '@/lib/meta/targeting';
import { validateAdsetPresetRequest } from '@/lib/meta/validate-adset-preset-request';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/app/generated/prisma/client';

export const dynamic = 'force-dynamic';

type PatchBody = {
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await prisma.adsetPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      billingEvent: true,
      optimizationGoal: true,
      promotedObject: true,
      bidStrategy: true,
      bidAmount: true,
      bidConstraints: true,
      pinnedCampaignId: true,
    },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const mergedMetaBody = {
    billingEvent: body.billingEvent !== undefined ? body.billingEvent : existing.billingEvent,
    optimizationGoal:
      body.optimizationGoal !== undefined ? body.optimizationGoal : existing.optimizationGoal,
    promotedObject:
      body.promotedObject !== undefined ? body.promotedObject : existing.promotedObject,
    bidStrategy: body.bidStrategy !== undefined ? body.bidStrategy : existing.bidStrategy,
    bidAmount: body.bidAmount !== undefined ? body.bidAmount : existing.bidAmount,
    bidConstraints:
      body.bidConstraints !== undefined ? body.bidConstraints : existing.bidConstraints,
    pinnedCampaignId:
      body.pinnedCampaignId !== undefined ? body.pinnedCampaignId : existing.pinnedCampaignId,
  };
  const metaValidation = await validateAdsetPresetRequest(session.companyId, mergedMetaBody);
  if (!metaValidation.ok) {
    return NextResponse.json({ error: metaValidation.error }, { status: 400 });
  }

  const scheduleDuration =
    body.scheduleDuration !== undefined ? parseScheduleDuration(body.scheduleDuration) : undefined;
  const scheduleCustomEnd =
    body.scheduleCustomEnd !== undefined ? parseIso(body.scheduleCustomEnd) : undefined;

  if (scheduleDuration === 'custom' && scheduleCustomEnd === null) {
    return NextResponse.json({ error: 'Custom end date is required when duration is custom' }, { status: 400 });
  }
  if (
    scheduleCustomEnd &&
    scheduleDuration !== undefined &&
    scheduleDuration !== null &&
    scheduleDuration !== 'custom'
  ) {
    return NextResponse.json({ error: 'scheduleCustomEnd is only valid with custom duration' }, { status: 400 });
  }

  const pinnedCampaignId =
    typeof body.pinnedCampaignId === 'string' ? body.pinnedCampaignId : undefined;
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

  const preset = await prisma.adsetPreset.update({
    where: { id: existing.id },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
      ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
      ...(typeof body.dailyBudget === 'number' || body.dailyBudget === null
        ? { dailyBudget: body.dailyBudget == null ? null : BigInt(Math.floor(body.dailyBudget)) }
        : {}),
      ...(typeof body.lifetimeBudget === 'number' || body.lifetimeBudget === null
        ? { lifetimeBudget: body.lifetimeBudget == null ? null : BigInt(Math.floor(body.lifetimeBudget)) }
        : {}),
      ...(body.scheduleDuration !== undefined
        ? {
            scheduleDuration,
            scheduleCustomEnd:
              scheduleDuration === 'custom' ? (scheduleCustomEnd ?? null) : null,
            ...(scheduleDuration ? { startTime: null, endTime: null } : {}),
          }
        : {}),
      ...(body.scheduleDuration === undefined && body.startTime !== undefined
        ? { startTime: parseIso(body.startTime) }
        : {}),
      ...(body.scheduleDuration === undefined && body.endTime !== undefined
        ? { endTime: parseIso(body.endTime) }
        : {}),
      ...(body.scheduleDuration === undefined && body.scheduleCustomEnd !== undefined
        ? { scheduleCustomEnd }
        : {}),
      billingEvent: metaValidation.fields.billingEvent,
      optimizationGoal: metaValidation.fields.optimizationGoal,
      promotedObject: metaValidation.fields.promotedObject as Prisma.InputJsonValue,
      ...(typeof body.destinationType === 'string' || body.destinationType === null ? { destinationType: body.destinationType as string | null } : {}),
      ...(typeof body.bidStrategy === 'string' || body.bidStrategy === null ? { bidStrategy: body.bidStrategy as string | null } : {}),
      ...(typeof body.bidAmount === 'number' || body.bidAmount === null
        ? { bidAmount: body.bidAmount == null ? null : BigInt(Math.floor(body.bidAmount)) }
        : {}),
      ...(typeof body.isDefaultCreative === 'boolean' ? { isDefaultCreative: body.isDefaultCreative } : {}),
      ...(typeof body.pacingType === 'string' || body.pacingType === null ? { pacingType: body.pacingType as string | null } : {}),
      ...(Array.isArray(body.attributionSpec)
        ? { attributionSpec: body.attributionSpec as Prisma.InputJsonValue }
        : {}),
      ...(pinnedCampaignId !== undefined
        ? (pinnedCampaignId
            ? { pinnedCampaign: { connect: { id: pinnedCampaignId } } }
            : { pinnedCampaign: { disconnect: true } })
        : {}),
      ...(typeof body.bidConstraints === 'object' && body.bidConstraints
        ? { bidConstraints: body.bidConstraints as Prisma.InputJsonValue }
        : {}),
      ...(typeof body.targeting === 'object' && body.targeting
        ? { targeting: (sanitizeMetaTargeting(body.targeting) ?? {}) as Prisma.InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json({ preset: jsonSafe(preset) });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const existing = await prisma.adsetPreset.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.adsetPreset.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}

