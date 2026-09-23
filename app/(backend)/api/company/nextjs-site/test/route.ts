import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { pingNextjsRevalidate } from '@/lib/nextjs/revalidate';
import { getConnectedNextjsSite } from '@/lib/nextjs/site';

export const dynamic = 'force-dynamic';

/**
 * Check the customer's install end to end: the revalidate endpoint accepts our secret and
 * the blog index route renders. Records the outcome on the site row for the UI.
 */
export async function POST() {
  const session = await getSession();
  if (!session?.companyId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const site = await getConnectedNextjsSite(session.companyId);
  if (!site) return NextResponse.json({ error: 'Next.js site is not connected' }, { status: 404 });

  const revalidate = await pingNextjsRevalidate(site, { type: 'test' });

  const indexUrl = `${site.siteUrl}${site.basePath}`;
  let indexOk = false;
  let indexReason: string | null = null;
  try {
    const res = await fetch(indexUrl, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    indexOk = res.ok;
    if (!res.ok) indexReason = `${indexUrl} returned ${res.status}`;
  } catch (e) {
    indexReason = e instanceof Error ? `Could not load ${indexUrl}: ${e.message}` : `Could not load ${indexUrl}`;
  }

  const problems = [revalidate.ok ? null : revalidate.reason, indexReason].filter(Boolean) as string[];
  await prisma.nextjsSite.update({
    where: { id: site.id },
    data: problems.length
      ? { lastError: problems.join(' · ').slice(0, 1000) }
      : { lastError: null, lastVerifiedAt: new Date() },
  });

  return NextResponse.json({
    ok: problems.length === 0,
    revalidate: revalidate.ok,
    blogIndex: indexOk,
    problems,
  });
}
