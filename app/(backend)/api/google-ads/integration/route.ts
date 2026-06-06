import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: {
      id: true,
      customerId: true,
      loginCustomerId: true,
      conversionActionId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ integration });
}

type PutBody = {
  customerId?: unknown;
  loginCustomerId?: unknown;
  conversionActionId?: unknown;
};

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : undefined;
  const loginCustomerId =
    typeof body.loginCustomerId === 'string' ? body.loginCustomerId.trim() : undefined;
  const conversionActionId =
    typeof body.conversionActionId === 'string' ? body.conversionActionId.trim() : undefined;

  const integration = await prisma.googleAdsIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: 'Google Ads not connected' }, { status: 400 });
  }

  const updated = await prisma.googleAdsIntegration.update({
    where: { companyId: session.companyId },
    data: {
      ...(customerId !== undefined ? { customerId } : {}),
      ...(loginCustomerId !== undefined ? { loginCustomerId } : {}),
      ...(conversionActionId !== undefined ? { conversionActionId } : {}),
    },
    select: { id: true, customerId: true, loginCustomerId: true, conversionActionId: true },
  });

  return NextResponse.json({ integration: updated });
}
