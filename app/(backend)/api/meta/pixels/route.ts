import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getAdAccountPixels } from '@/lib/meta/client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { adAccountId: true },
  });
  if (!integration?.adAccountId) {
    return NextResponse.json({ pixels: [], hasAccountPixel: false });
  }

  try {
    const pixels = await getAdAccountPixels(integration.adAccountId, {
      companyId: session.companyId,
    });
    const available = pixels.filter((p) => p.is_unavailable !== true);
    return NextResponse.json({
      pixels: available.map((p) => ({ id: p.id, name: p.name ?? p.id })),
      hasAccountPixel: available.length > 0,
    });
  } catch (e) {
    console.error('[meta/pixels]', e);
    return NextResponse.json({ pixels: [], hasAccountPixel: false, error: 'Failed to load pixels' });
  }
}
