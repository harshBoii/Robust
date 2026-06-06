import 'server-only';

import { prisma } from '@/lib/prisma';
import { GoogleAdsApiError } from '@/lib/google-ads/errors';

export class GoogleAdsIntegrationIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAdsIntegrationIncompleteError';
  }
}

/** Resolve the refresh token for a company's Google Ads integration. */
export async function resolveGoogleAdsRefreshToken(companyId: string): Promise<string> {
  const row = await prisma.googleAdsIntegration.findUnique({
    where: { companyId },
    select: { refreshToken: true },
  });
  if (!row?.refreshToken) {
    throw new GoogleAdsIntegrationIncompleteError('Google Ads is not connected');
  }
  return row.refreshToken;
}

/** Require a customerId to be configured; throw a friendly error otherwise. */
export async function requireGoogleCustomerId(companyId: string): Promise<string> {
  const row = await prisma.googleAdsIntegration.findUnique({
    where: { companyId },
    select: { customerId: true, loginCustomerId: true },
  });
  const id = row?.customerId?.trim();
  if (!id) {
    throw new GoogleAdsIntegrationIncompleteError(
      'Google Ads customer ID is not configured. Set it in workspace integration settings.',
    );
  }
  return id;
}

export function requireGoogleAdsEnv() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !developerToken || !redirectUri) {
    throw new GoogleAdsApiError({
      message: 'Google Ads environment variables are not configured',
      code: 'CONFIG',
    });
  }
  return { clientId, clientSecret, developerToken, redirectUri };
}

export function isGoogleAdsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() &&
      process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() &&
      process.env.GOOGLE_ADS_REDIRECT_URI?.trim(),
  );
}
