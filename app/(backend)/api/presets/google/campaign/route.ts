import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/app/generated/prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const presets = await prisma.googleCampaignPreset.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ presets });
}

type PostBody = {
  name?: unknown;
  campaignType?: unknown;
  biddingStrategy?: unknown;
  dailyBudgetMicros?: unknown;
  totalBudgetMicros?: unknown;
  targetCpaMicros?: unknown;
  targetRoas?: unknown;
  geoTargets?: unknown;
  languages?: unknown;
  status?: unknown;
  isDefault?: unknown;
};

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
  const campaignType = typeof body.campaignType === 'string' ? body.campaignType : 'DISPLAY';
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const preset = await prisma.googleCampaignPreset.create({
    data: {
      companyId: session.companyId,
      name,
      campaignType,
      biddingStrategy: typeof body.biddingStrategy === 'string' ? body.biddingStrategy : null,
      dailyBudgetMicros:
        typeof body.dailyBudgetMicros === 'number'
          ? BigInt(Math.round(body.dailyBudgetMicros))
          : null,
      totalBudgetMicros:
        typeof body.totalBudgetMicros === 'number'
          ? BigInt(Math.round(body.totalBudgetMicros))
          : null,
      targetCpaMicros:
        typeof body.targetCpaMicros === 'number'
          ? BigInt(Math.round(body.targetCpaMicros))
          : null,
      targetRoas: typeof body.targetRoas === 'number' ? body.targetRoas : null,
      geoTargets: (Array.isArray(body.geoTargets) ? body.geoTargets : []) as Prisma.InputJsonValue,
      languages: (Array.isArray(body.languages) ? body.languages : []) as Prisma.InputJsonValue,
      status: typeof body.status === 'string' ? body.status : null,
      isDefault: body.isDefault === true,
    },
  });

  return NextResponse.json({ preset }, { status: 201 });
}
