import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/rival-analysis/rivals
export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rivals = await prisma.companyRival.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'asc' },
    include: {
      scrapeRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  return NextResponse.json({ rivals });
}

const CreateRivalSchema = z.object({
  brandName: z.string().min(1).max(255),
  pageName: z.string().min(1).max(255),
  country: z.string().length(2).toUpperCase().default('IN'),
});

// POST /api/rival-analysis/rivals
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateRivalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  const { brandName, pageName, country } = parsed.data;

  try {
    const rival = await prisma.companyRival.create({
      data: {
        companyId: session.companyId,
        brandName,
        pageName,
        country,
      },
    });
    return NextResponse.json({ rival }, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes('Unique constraint')
    ) {
      return NextResponse.json(
        { error: 'A rival with this page name already exists.' },
        { status: 409 },
      );
    }
    throw err;
  }
}
