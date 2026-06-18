import { NextResponse } from 'next/server';

import { previewDomain } from '@/lib/onboarding/domain-preview';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

type Body = { domain?: string };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const domain = typeof body.domain === 'string' ? body.domain.trim() : '';
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 });
  }

  const preview = await previewDomain(domain);
  return NextResponse.json({ preview });
}
