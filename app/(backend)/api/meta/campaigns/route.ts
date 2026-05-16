import { NextRequest, NextResponse } from 'next/server';

import { apiErrorFromUnknown } from '@/lib/meta/errors';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { syncCampaigns, createAndStoreCampaignFromPreset } from '@/lib/meta/sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ campaigns: [] });

  const campaigns = await syncCampaigns(integration.id);
  return NextResponse.json({ campaigns });
}

type PostBody = { presetId?: unknown; name?: unknown };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) return NextResponse.json({ error: 'Meta not connected' }, { status: 400 });

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const presetId = typeof body.presetId === 'string' ? body.presetId : '';
  const name = typeof body.name === 'string' ? body.name : undefined;
  if (!presetId) return NextResponse.json({ error: 'Missing presetId' }, { status: 400 });

  const preset = await prisma.campaignPreset.findFirst({
    where: { id: presetId, companyId: session.companyId },
    select: { id: true },
  });
  if (!preset) return NextResponse.json({ error: 'Preset not found' }, { status: 404 });

  try {
    const campaign = await createAndStoreCampaignFromPreset({
      metaIntegrationId: integration.id,
      presetId,
      name,
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    const { status, error, metaError } = apiErrorFromUnknown(err);
    return NextResponse.json({ error, ...(metaError ? { metaError } : {}) }, { status });
  }
}

