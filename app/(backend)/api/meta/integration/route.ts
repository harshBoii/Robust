import { NextRequest, NextResponse } from 'next/server';

import { isMetaOAuthConfigured } from '@/lib/auth/meta-oauth-state';
import { getSession } from '@/lib/auth/session';
import { normalizeMetaAdAccountId } from '@/lib/meta/ad-account-id';
import {
  isUserMetaOAuthToken,
  META_INTEGRATION_PLACEHOLDER_TOKEN,
} from '@/lib/meta/integration-token';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PutBody = {
  adAccountId?: unknown;
  fbPageId?: unknown;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const row = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: {
      id: true,
      companyId: true,
      adAccountId: true,
      fbPageId: true,
      contextBuiltAt: true,
      createdAt: true,
      updatedAt: true,
      accessToken: true,
    },
  });

  const metaIntegration = row
    ? {
        id: row.id,
        companyId: row.companyId,
        adAccountId: row.adAccountId,
        fbPageId: row.fbPageId,
        contextBuiltAt: row.contextBuiltAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;

  return NextResponse.json({
    metaIntegration,
    hasSystemToken: Boolean(process.env.META_SYSTEM_ACCESS_TOKEN),
    hasMetaOAuth: isMetaOAuthConfigured(),
    hasUserOAuthToken: isUserMetaOAuthToken(row?.accessToken),
    hasAdAccountAndPage: Boolean(row?.adAccountId && row?.fbPageId),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const adAccountIdRaw = typeof body.adAccountId === 'string' ? body.adAccountId : '';
  const fbPageIdRaw = typeof body.fbPageId === 'string' ? body.fbPageId : '';

  const adAccountId = normalizeMetaAdAccountId(adAccountIdRaw);
  const fbPageId = fbPageIdRaw.trim();

  if (!adAccountId || !adAccountId.startsWith('act_')) {
    return NextResponse.json({ error: 'Invalid adAccountId (expected act_XXXXXXXX)' }, { status: 400 });
  }
  if (!fbPageId || !/^\d{5,}$/.test(fbPageId)) {
    return NextResponse.json({ error: 'Invalid fbPageId (expected numeric id)' }, { status: 400 });
  }

  const metaIntegration = await prisma.metaIntegration.upsert({
    where: { companyId: session.companyId },
    create: {
      companyId: session.companyId,
      accessToken: META_INTEGRATION_PLACEHOLDER_TOKEN,
      adAccountId,
      fbPageId,
    },
    update: {
      adAccountId,
      fbPageId,
    },
    select: {
      id: true,
      companyId: true,
      adAccountId: true,
      fbPageId: true,
      contextBuiltAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ metaIntegration });
}

