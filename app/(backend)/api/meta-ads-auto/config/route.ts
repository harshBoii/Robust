import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import {
  getMetaAdsAutoConfig,
  upsertMetaAdsAutoConfig,
  validateMetaAdsAutoConfigPatch,
  type MetaAdsAutoConfigPatch,
} from '@/lib/meta-ads-auto/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = await getMetaAdsAutoConfig(session.companyId);
  return NextResponse.json({ config });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: MetaAdsAutoConfigPatch;
  try {
    body = (await req.json()) as MetaAdsAutoConfigPatch;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = validateMetaAdsAutoConfigPatch(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const config = await upsertMetaAdsAutoConfig(session.companyId, validated.data);
  return NextResponse.json({ config });
}
