import { verifySessionToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';

export type ResolvedSession = {
  companyId: string;
  userName: string;
  slug: string;
  sessionId: string;
};

/** Validate JWT + server-side auth_sessions row. Used by proxy and getSession. */
export async function resolveSessionFromToken(
  token: string,
): Promise<ResolvedSession | null> {
  try {
    const payload = await verifySessionToken(token);
    const sessionId = payload.jti as string | undefined;
    if (!sessionId || !payload.sub) return null;

    const row = await prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!row || row.revokedAt || row.expiresAt <= new Date()) return null;

    return {
      companyId: payload.sub,
      userName: (payload.userName as string) ?? '',
      slug: (payload.slug as string) ?? '',
      sessionId,
    };
  } catch {
    return null;
  }
}
