import { Prisma } from '@/app/generated/prisma/client';
import { NextResponse } from 'next/server';

import {
  clearOnboardingCookie,
  requireOnboardingSession,
} from '@/lib/auth/onboarding-session';
import { hashPassword } from '@/lib/auth/password';
import { getOnboardingSnapshot } from '@/lib/onboarding/snapshot';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = {
  userName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userName = typeof body.userName === 'string' ? body.userName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirmPassword =
    typeof body.confirmPassword === 'string' ? body.confirmPassword : password;

  if (!userName || !email || !password) {
    return NextResponse.json(
      { error: 'userName, email, and password are required' },
      { status: 400 },
    );
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'password must be at least 8 characters' },
      { status: 400 },
    );
  }

  const passwordHashed = await hashPassword(password);

  try {
    await prisma.company.update({
      where: { id: session.companyId },
      data: {
        userName,
        email,
        emailVerifiedAt: new Date(),
        password: passwordHashed,
        accessRequestedAt: new Date(),
        onboardingStep: 'done',
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = e.meta?.target as string[] | undefined;
      const field = target?.includes('userName')
        ? 'userName'
        : target?.includes('email')
          ? 'email'
          : 'field';
      return NextResponse.json(
        {
          error:
            field === 'userName'
              ? 'This username is already taken'
              : field === 'email'
                ? 'This email is already registered'
                : 'Unique constraint violated',
        },
        { status: 409 },
      );
    }
    throw e;
  }

  const snap = await getOnboardingSnapshot(session.companyId);
  const res = NextResponse.json({
    company: snap,
    message: 'Access request submitted. You will be notified when approved.',
  });
  clearOnboardingCookie(res);
  return res;
}
