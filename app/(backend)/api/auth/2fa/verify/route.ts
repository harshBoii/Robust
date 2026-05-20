import { NextResponse } from 'next/server';

import { establishSessionResponse } from '@/lib/auth/establish-session';
import { verifyPendingLoginToken } from '@/lib/auth/pending-login';
import { getRequestIp, getRequestUserAgent } from '@/lib/auth/request-meta';
import { logLoginActivity } from '@/lib/auth/session-store';
import { verifyCompanyTotp } from '@/lib/auth/two-factor';
import { prisma } from '@/lib/prisma';

type Body = {
  pendingToken?: string;
  code?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const pendingToken = typeof body.pendingToken === 'string' ? body.pendingToken.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!pendingToken || !code) {
    return NextResponse.json({ error: 'pendingToken and code are required' }, { status: 400 });
  }

  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  let companyId: string;
  let userName: string;
  let slug: string;
  try {
    const pending = await verifyPendingLoginToken(pendingToken);
    companyId = pending.companyId;
    userName = pending.userName;
    slug = pending.slug;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired verification session' }, { status: 401 });
  }

  const valid = await verifyCompanyTotp(companyId, code);
  if (!valid) {
    await logLoginActivity({
      companyId,
      success: false,
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      slug: true,
      userName: true,
      email: true,
      logoUrl: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  await logLoginActivity({
    companyId,
    success: true,
    ipAddress,
    userAgent,
  });

  try {
    return await establishSessionResponse({
      companyId,
      userName: company.userName ?? userName,
      slug: company.slug,
      userAgent,
      ipAddress,
      body: {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
          userName: company.userName,
          email: company.email,
          logoUrl: company.logoUrl,
          subscriptionStatus: company.subscriptionStatus,
          createdAt: company.createdAt,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
