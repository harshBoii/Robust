import { NextRequest, NextResponse } from 'next/server';

import {
  AssetDownloadError,
  buildAssetDownloadResponse,
} from '@/lib/asset-intelligence/download';

export const dynamic = 'force-dynamic';

function parseDownloadOptions(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const expiresIn = sp.get('expiresIn');
  return {
    expiresIn: expiresIn ? Number(expiresIn) : undefined,
    responseContentType: sp.get('responseContentType') ?? undefined,
    responseContentDisposition: sp.get('responseContentDisposition') ?? undefined,
    filename: sp.get('filename') ?? undefined,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: assetId } = await context.params;

  try {
    const data = await buildAssetDownloadResponse(assetId, parseDownloadOptions(req));
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof AssetDownloadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[assets/download]', e);
    return NextResponse.json({ error: 'Failed to build download' }, { status: 500 });
  }
}
