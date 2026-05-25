import { NextRequest, NextResponse } from 'next/server';

import { callProcessFromApiBatch } from '@/lib/asset-intelligence/microservice-client';
import { analyzeRequestSchema } from '@/lib/asset-intelligence/types';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const assetIds = parsed.data.assets.map((a) => a.assetId);
  const owned = await prisma.asset.findMany({
    where: { id: { in: assetIds }, companyId: session.companyId },
    select: { id: true },
  });

  if (owned.length !== assetIds.length) {
    return NextResponse.json({ error: 'One or more assets not found' }, { status: 404 });
  }

  await prisma.asset.updateMany({
    where: { id: { in: assetIds }, companyId: session.companyId },
    data: { intelligenceStatus: 'PROCESSING' },
  });

  try {
    const jobIds = await callProcessFromApiBatch(parsed.data.assets);
    return NextResponse.json({ jobIds });
  } catch (e) {
    await prisma.asset.updateMany({
      where: { id: { in: assetIds }, companyId: session.companyId },
      data: { intelligenceStatus: 'FAILED' },
    });
    const message = e instanceof Error ? e.message : 'Analysis request failed';
    console.error('[ads/analyze]', e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
