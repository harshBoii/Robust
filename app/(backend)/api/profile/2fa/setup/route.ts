import { NextResponse } from 'next/server';

import {
  buildTwoFactorQrDataUrl,
  generateTwoFactorSecret,
  storePendingTwoFactorSecret,
} from '@/lib/auth/two-factor';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const company = await prisma.company.findUnique({
    where: { id: session!.companyId },
    select: { twoFactorEnabled: true, userName: true, email: true, name: true },
  });

  if (!company) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  if (company.twoFactorEnabled) {
    return NextResponse.json({ error: 'Two-factor authentication is already enabled' }, { status: 400 });
  }

  const secret = generateTwoFactorSecret();
  await storePendingTwoFactorSecret(session!.companyId, secret);

  const label = company.userName ?? company.email ?? company.name;
  const qrDataUrl = await buildTwoFactorQrDataUrl(secret, label);

  return NextResponse.json({ qrDataUrl });
}
