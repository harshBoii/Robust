import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * Returns the company's logo URL if one is set, otherwise null.
 * Used to append the logo as a reference image in every generation call.
 */
export async function resolveCompanyLogoUrl(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true },
  });
  return company?.logoUrl?.trim() || null;
}

/** Appends the logo URL to a reference image array when available. */
export function appendLogoRef(refUrls: string[], logoUrl: string | null | undefined): string[] {
  if (!logoUrl?.trim()) return refUrls;
  return [...refUrls, logoUrl.trim()];
}
