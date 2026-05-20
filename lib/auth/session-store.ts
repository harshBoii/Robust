import 'server-only';

import { prisma } from '@/lib/prisma';
import { authCookieMaxAge } from '@/lib/auth/jwt';

export async function createAuthSession(args: {
  sessionId: string;
  companyId: string;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<void> {
  const maxAgeSec = authCookieMaxAge();
  const expiresAt = new Date(Date.now() + maxAgeSec * 1000);
  await prisma.authSession.create({
    data: {
      id: args.sessionId,
      companyId: args.companyId,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      expiresAt,
    },
  });
}

export async function touchAuthSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { lastSeenAt: new Date() },
  });
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function isAuthSessionValid(sessionId: string): Promise<boolean> {
  const row = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, expiresAt: true },
  });
  if (!row || row.revokedAt) return false;
  return row.expiresAt > new Date();
}

export async function logLoginActivity(args: {
  companyId: string | null;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  await prisma.loginActivity.create({
    data: {
      companyId: args.companyId,
      success: args.success,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    },
  });
}

export async function countActiveSessions(companyId: string): Promise<number> {
  const now = new Date();
  return prisma.authSession.count({
    where: {
      companyId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
}
