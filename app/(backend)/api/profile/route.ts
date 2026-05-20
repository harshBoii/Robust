import { NextResponse } from 'next/server';

import { requireProfileSession } from '@/lib/profile/api-auth';
import { resolveLogoUrlFromAssetId } from '@/lib/profile/logo-asset';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PatchBody = {
  name?: unknown;
  email?: unknown;
  description?: unknown;
  website?: unknown;
  domain?: unknown;
  logoUrl?: unknown;
  logoAssetId?: unknown;
};

function trimOptionalString(v: unknown, maxLen: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export async function PATCH(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = trimOptionalString(body.name, 255);
  const email = trimOptionalString(body.email, 255);
  const description = trimOptionalString(body.description, 5000);
  const website = trimOptionalString(body.website, 500);
  const domain = trimOptionalString(body.domain, 255);
  const logoUrl = trimOptionalString(body.logoUrl, 1000);
  const logoAssetId =
    body.logoAssetId === null
      ? null
      : typeof body.logoAssetId === 'string'
        ? body.logoAssetId.trim() || null
        : undefined;

  let resolvedLogoUrl: string | null | undefined = logoUrl;
  if (logoAssetId !== undefined) {
    if (logoAssetId === null) {
      resolvedLogoUrl = null;
    } else {
      try {
        resolvedLogoUrl = await resolveLogoUrlFromAssetId(session!.companyId, logoAssetId);
      } catch {
        return NextResponse.json({ error: 'Invalid logo image' }, { status: 400 });
      }
    }
  }

  if (
    name === undefined &&
    email === undefined &&
    description === undefined &&
    website === undefined &&
    domain === undefined &&
    resolvedLogoUrl === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({
    where: { id: session!.companyId },
    select: { email: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  if (email) {
    const taken = await prisma.company.findFirst({
      where: { email, NOT: { id: session!.companyId } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
    }
  }

  const emailChanged = email !== undefined && email !== existing.email;

  try {
    const company = await prisma.company.update({
      where: { id: session!.companyId },
      data: {
        ...(name !== undefined ? { name: name ?? 'Company' } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(domain !== undefined ? { domain } : {}),
        ...(resolvedLogoUrl !== undefined ? { logoUrl: resolvedLogoUrl } : {}),
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        userName: true,
        email: true,
        description: true,
        website: true,
        domain: true,
        logoUrl: true,
        emailVerifiedAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      company: {
        ...company,
        emailVerified: Boolean(company.emailVerifiedAt),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
