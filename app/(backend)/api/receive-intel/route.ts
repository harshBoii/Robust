import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  IntelWebhookError,
  parseIntelPayload,
  upsertAssetIntelligence,
} from '@/lib/asset-intelligence/webhook';

export const dynamic = 'force-dynamic';

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function authorizeIntelWebhook(req: NextRequest): NextResponse | null {
  const secret = process.env.INTEL_WEBHOOK_SECRET?.trim();
  if (!secret) return null;

  const header = req.headers.get('x-intel-secret')?.trim() ?? '';
  if (!header || !timingSafeEqualStrings(secret, header)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {

  let body: unknown;
  try {
    body = await req.json();
    console.log('body', body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const payload = parseIntelPayload(body);
    console.log('payload', payload);
    await upsertAssetIntelligence(payload);
    console.log('upserted');
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof IntelWebhookError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[receive-intel]', e);
    return NextResponse.json({ error: 'Failed to store intelligence' }, { status: 500 });
  }
}
