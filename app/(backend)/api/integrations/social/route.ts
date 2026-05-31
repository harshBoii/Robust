import { NextResponse } from 'next/server';
import type { SocialProvider } from '@/app/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { getZernioClient, isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';
import { ZERNIO_SOCIAL_PROVIDERS } from '@/lib/zernio/platforms';

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: { companyId: session.companyId },
    select: {
      provider: true,
      accountHandle: true,
      zernioAccountId: true,
      updatedAt: true,
    },
  });

  const byProvider = Object.fromEntries(integrations.map((i) => [i.provider, i]));
  const zernioConfigured = isZernioConfigured();

  return NextResponse.json({
    success: true,
    providers: ZERNIO_SOCIAL_PROVIDERS.map((provider) => ({
      provider,
      connected: Boolean(byProvider[provider]?.zernioAccountId),
      accountHandle: byProvider[provider]?.accountHandle ?? null,
      expiresAt: null,
      oauthConfigured: zernioConfigured,
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const provider = body.provider as SocialProvider | undefined;
  if (!provider || !ZERNIO_SOCIAL_PROVIDERS.includes(provider)) {
    return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 });
  }

  const integration = await prisma.socialIntegration.findUnique({
    where: {
      companyId_provider: { companyId: session.companyId, provider },
    },
    select: { zernioAccountId: true },
  });

  if (integration?.zernioAccountId && isZernioConfigured()) {
    try {
      const zernio = getZernioClient();
      await zernio.accounts.deleteAccount({
        path: { accountId: integration.zernioAccountId },
      });
    } catch (err) {
      console.error('[zernio disconnect]', err);
      return NextResponse.json(
        { success: false, error: zernioApiErrorMessage(err) },
        { status: 502 },
      );
    }
  }

  await prisma.socialIntegration.deleteMany({
    where: { companyId: session.companyId, provider },
  });

  return NextResponse.json({ success: true });
}
