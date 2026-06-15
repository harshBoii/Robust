import 'server-only';

import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import {
  creativeSuggestForAsset,
  CreativeRateLimitError,
} from '@/lib/assistant/creative-suggest-for-asset';

export const dynamic = 'force-dynamic';

type Body = {
  assetId?: unknown;
  adType?: unknown;
  tone?: unknown;
  groupLabel?: unknown;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : '';
  const adType = typeof body.adType === 'string' ? body.adType.trim() : '';
  const tone = typeof body.tone === 'string' ? body.tone.trim() : '';
  const groupLabel = typeof body.groupLabel === 'string' ? body.groupLabel.trim() : undefined;

  if (!assetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  console.log('[chats:creative-ai] creative-suggest', {
    companyId: session.companyId,
    assetId,
    groupLabel,
    adType,
  });

  try {
    const result = await creativeSuggestForAsset({
      companyId: session.companyId,
      assetId,
      adType: adType || undefined,
      tone: tone || undefined,
      groupLabel,
    });

    console.log('[chats:creative-ai] creative-suggest ok', {
      assetId,
      headline: result.headline?.slice(0, 40),
    });

    return NextResponse.json({
      ...result,
      skippedFields: [] as string[],
    });
  } catch (err) {
    if (err instanceof CreativeRateLimitError) {
      return NextResponse.json({ error: err.message, remaining: 0 }, { status: 429 });
    }
    const message = err instanceof Error ? err.message : 'Failed to generate creative suggestions';
    const status = message.includes('not found') ? 404 : message.includes('processing') ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
