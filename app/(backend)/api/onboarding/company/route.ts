import { AccessStatus, Prisma } from '@/app/generated/prisma/client';
import { NextResponse } from 'next/server';

import {
  establishOnboardingResponse,
  getOnboardingSession,
  requireOnboardingSession,
} from '@/lib/auth/onboarding-session';
import { domainToWebsite, normalizeDomain, slugify } from '@/lib/onboarding/domain';
import { getOnboardingSnapshot } from '@/lib/onboarding/snapshot';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  domain?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const existing = await getOnboardingSession();
  if (existing) {
    const snap = await getOnboardingSnapshot(existing.companyId);
    if (snap && snap.accessStatus === AccessStatus.PENDING && !snap.accessRequestedAt) {
      return NextResponse.json({ company: snap });
    }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const domain = typeof body.domain === 'string' ? normalizeDomain(body.domain) : '';

  if (!name || !domain) {
    return NextResponse.json({ error: 'name and domain are required' }, { status: 400 });
  }

  const website = domainToWebsite(domain);
  const slug = slugify(name);

  try {
    const company = await prisma.company.create({
      data: {
        name,
        slug,
        domain,
        website,
        accessStatus: AccessStatus.PENDING,
        onboardingStep: 'enriching',
        brandEntity: {
          create: {
            canonicalName: name,
          },
        },
      },
      select: { id: true },
    });

    const snap = await getOnboardingSnapshot(company.id);
    return establishOnboardingResponse(company.id, { company: snap });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'A company with this name or domain may already exist' },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function GET() {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  const snap = await getOnboardingSnapshot(session.companyId);
  if (!snap) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }
  return NextResponse.json({ company: snap });
}

export async function PATCH(request: Request) {
  const { session, error } = await requireOnboardingSession();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const companyId = session.companyId;
  const companyUpdate: Prisma.CompanyUpdateInput = {};
  if (typeof body.onboardingStep === 'string') {
    companyUpdate.onboardingStep = body.onboardingStep.slice(0, 64);
  }

  const brandFields = [
    'canonicalName',
    'industry',
    'oneLiner',
    'category',
    'businessModel',
  ] as const;

  const brandUpdate: Prisma.BrandEntityUpdateInput = {};
  for (const key of brandFields) {
    if (typeof body[key] === 'string') {
      (brandUpdate as Record<string, string>)[key] = (body[key] as string).trim();
    }
  }
  if (Array.isArray(body.targetAudiences)) {
    brandUpdate.targetAudiences = (body.targetAudiences as unknown[])
      .filter((v): v is string => typeof v === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  } else if (typeof body.primaryAudience === 'string' && body.primaryAudience.trim()) {
    brandUpdate.targetAudiences = [body.primaryAudience.trim()];
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(companyUpdate).length > 0) {
      await tx.company.update({ where: { id: companyId }, data: companyUpdate });
    }
    if (Object.keys(brandUpdate).length > 0) {
      await tx.brandEntity.update({ where: { companyId }, data: brandUpdate });
    }
  });

  const snap = await getOnboardingSnapshot(companyId);
  return NextResponse.json({ company: snap });
}
