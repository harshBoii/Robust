import { NextResponse } from 'next/server';

import { requireProfileSession } from '@/lib/profile/api-auth';
import { listLogoAssetCandidates } from '@/lib/profile/logo-asset';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  const assets = await listLogoAssetCandidates(session!.companyId);

  return NextResponse.json({
    assets: assets.map((asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString(),
    })),
  });
}
