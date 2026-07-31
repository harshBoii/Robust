import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { approveBountyToWordPress } from '@/lib/geo/bounty/approveBountyToWordPress';
import { isWordPressApiError, wordPressErrorMessage } from '@/lib/wordpress/errors';

/** Map a typed WordPress client error onto a meaningful HTTP status. */
function statusForError(code: string): number {
  switch (code) {
    case 'WP_NOT_CONNECTED':
      return 404;
    case 'WP_NOT_CONFIGURED':
      return 500;
    case 'WP_UNAUTHORIZED':
      return 401;
    case 'WP_FORBIDDEN':
      return 403;
    case 'WP_TIMEOUT':
      return 504;
    default:
      return 502;
  }
}

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: bountyId } = await context.params;

  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const result = await approveBountyToWordPress({
      companyId: session.companyId,
      bountyId,
    });

    return NextResponse.json({
      success: true,
      data: {
        postId: result.postId,
        link: result.canonicalUrl ?? undefined,
        channelSlug: result.channelSlug,
        schemaMode: result.schemaMode,
        schemaAttached: result.schemaAttached,
        schemaVerified: result.schemaVerified,
        warnings: result.warnings,
      },
    });
  } catch (err) {
    if (isWordPressApiError(err)) {
      return NextResponse.json(
        { success: false, error: wordPressErrorMessage(err), code: err.code },
        { status: statusForError(err.code) },
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Bounty or generated page not found') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }

    console.error('[geo/approve-wordpress]', err);
    return NextResponse.json(
      { success: false, error: message || 'Failed to publish to WordPress' },
      { status: 502 },
    );
  }
}
