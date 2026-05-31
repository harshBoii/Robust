import { type NextRequest, NextResponse } from 'next/server';
import type { SocialProvider } from '@/app/generated/prisma/client';

import { getSession } from '@/lib/auth/session';
import { ensureZernioProfile } from '@/lib/zernio/ensure-profile';
import { getZernioClient, isZernioConfigured, zernioApiErrorMessage } from '@/lib/zernio/client';
import { toZernioPlatform } from '@/lib/zernio/platforms';

const PROVIDERS: SocialProvider[] = ['X', 'LINKEDIN', 'REDDIT'];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isZernioConfigured()) {
    return NextResponse.redirect(
      new URL('/profile/integration?zernio_error=config', request.url),
    );
  }

  const providerParam = request.nextUrl.searchParams.get('provider')?.toUpperCase();
  const provider = PROVIDERS.includes(providerParam as SocialProvider)
    ? (providerParam as SocialProvider)
    : null;

  if (!provider) {
    return NextResponse.redirect(
      new URL('/profile/integration?zernio_error=invalid_provider', request.url),
    );
  }

  try {
    const zernioProfileId = await ensureZernioProfile(session.companyId);
    const platform = toZernioPlatform(provider);
    const origin = request.nextUrl.origin;
    const redirectUrl = new URL('/profile/integration', origin);
    redirectUrl.searchParams.set('zernio_connected', platform);

    const zernio = getZernioClient();
    const { data, error } = await zernio.connect.getConnectUrl({
      path: { platform },
      query: {
        profileId: zernioProfileId,
        redirect_url: redirectUrl.toString(),
      },
    });

    const authUrl = data?.authUrl;
    if (error || !authUrl) {
      return NextResponse.redirect(
        new URL(
          `/profile/integration?zernio_error=connect&provider=${platform}`,
          request.url,
        ),
      );
    }

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('[zernio connect]', err);
    return NextResponse.redirect(
      new URL('/profile/integration?zernio_error=connect', request.url),
    );
  }
}
