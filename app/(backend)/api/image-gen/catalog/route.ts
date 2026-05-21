import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getCatalogForWidget } from '@/lib/image-gen/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getCatalogForWidget());
}
