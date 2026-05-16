import 'server-only';

import { prisma } from '@/lib/prisma';

export const META_INTEGRATION_PLACEHOLDER_TOKEN = 'SYSTEM_TOKEN';

export function isUserMetaOAuthToken(accessToken: string | null | undefined): boolean {
  const t = accessToken?.trim();
  return Boolean(t && t !== META_INTEGRATION_PLACEHOLDER_TOKEN);
}

/** User OAuth token for the company, or null if only the placeholder / missing row. */
export async function getCompanyMetaUserToken(companyId: string): Promise<string | null> {
  const row = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { accessToken: true },
  });
  if (!isUserMetaOAuthToken(row?.accessToken)) return null;
  return row!.accessToken;
}

/** Prefer per-company OAuth token; fall back to META_SYSTEM_ACCESS_TOKEN. */
export async function resolveMetaGraphAccessToken(companyId: string): Promise<string> {
  const userToken = await getCompanyMetaUserToken(companyId);
  if (userToken) return userToken;

  const system = process.env.META_SYSTEM_ACCESS_TOKEN?.trim();
  if (!system) {
    throw new Error('META_SYSTEM_ACCESS_TOKEN is not set');
  }
  return system;
}

export {
  MetaIntegrationIncompleteError,
  normalizeMetaAdAccountId,
  requireMetaAdAccountId,
} from '@/lib/meta/ad-account-id';

export function requireMetaFbPageId(fbPageId: string | null | undefined): string {
  const id = fbPageId?.trim();
  if (!id) throw new MetaIntegrationIncompleteError();
  return id;
}
