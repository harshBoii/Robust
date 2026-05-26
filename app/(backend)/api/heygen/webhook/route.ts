import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import {
  HeygenWebhookError,
  handleHeygenWebhook,
  parseHeygenWebhook,
} from '@/lib/heygen/webhook';

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

function authorizeHeygenWebhook(req: NextRequest): NextResponse | null {
  const secret = process.env.HEYGEN_WEBHOOK_SECRET?.trim();
  if (!secret) return null;

  const header = req.headers.get('x-heygen-secret')?.trim() ?? '';
  if (!header || !timingSafeEqualStrings(secret, header)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const authError = authorizeHeygenWebhook(req);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const payload = parseHeygenWebhook(body);
    await handleHeygenWebhook(payload);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof HeygenWebhookError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[heygen/webhook]', e);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
