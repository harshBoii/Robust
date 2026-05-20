import { NextResponse } from 'next/server';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  if (newPassword.length > 1024) {
    return NextResponse.json({ error: 'Password too long' }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session!.companyId },
    select: { password: true },
  });

  if (!company?.password) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const ok = await verifyPassword(currentPassword, company.password);
  if (!ok) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const passwordHashed = await hashPassword(newPassword);
  await prisma.company.update({
    where: { id: session!.companyId },
    data: { password: passwordHashed },
  });

  return NextResponse.json({ ok: true });
}
