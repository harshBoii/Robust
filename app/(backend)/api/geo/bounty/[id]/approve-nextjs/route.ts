import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { approveBountyToNextjs } from '@/lib/geo/bounty/approveBountyToNextjs';

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: bountyId } = await context.params;

  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await approveBountyToNextjs({ companyId: session.companyId, bountyId });
    return NextResponse.json({
      success: true,
      data: {
        link: result.canonicalUrl,
        revalidated: result.revalidated,
        schemaVerified: result.schemaVerified,
        warnings: result.warnings,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Bounty or generated page not found') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.startsWith('Next.js site is not connected')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    console.error('[geo/approve-nextjs]', err);
    return NextResponse.json(
      { success: false, error: message || 'Failed to publish to Next.js site' },
      { status: 502 },
    );
  }
}
