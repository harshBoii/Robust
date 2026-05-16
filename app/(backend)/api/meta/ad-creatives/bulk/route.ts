import { NextRequest, NextResponse } from 'next/server';

import { apiErrorFromUnknown } from '@/lib/meta/errors';
import { storeAdCreativeForAsset } from '@/lib/meta/store-ad-creative';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type BulkItem = {
  assetId?: unknown;
  headline?: unknown;
  primaryText?: unknown;
  description?: unknown;
  landingUrl?: unknown;
  ctaType?: unknown;
  pixelId?: unknown;
};

type BulkBody = {
  campaignId?: unknown;
  items?: unknown;
  recreate?: unknown;
};

export type BulkAdCreativeResult = {
  assetId: string;
  ok: boolean;
  creative?: {
    id: string;
    metaCreativeId: string;
    assetId: string | null;
    headline: string;
    primaryText: string;
    description: string | null;
    ctaType: string;
    landingUrl: string;
    imageHash: string | null;
    videoId: string | null;
    thumbnailUrl: string | null;
  };
  error?: string;
  metaError?: {
    message?: string;
    title?: string;
    code?: number;
  };
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const campaignId =
    typeof body.campaignId === 'string' && body.campaignId.trim()
      ? body.campaignId.trim()
      : null;
  const recreate = body.recreate === true;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Missing items array' }, { status: 400 });
  }

  const results: BulkAdCreativeResult[] = [];

  for (const raw of body.items as BulkItem[]) {
    const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
    const headline = typeof raw.headline === 'string' ? raw.headline.trim() : '';
    const primaryText = typeof raw.primaryText === 'string' ? raw.primaryText.trim() : '';
    const landingUrl = typeof raw.landingUrl === 'string' ? raw.landingUrl.trim() : '';
    const ctaType = typeof raw.ctaType === 'string' ? raw.ctaType.trim() : 'LEARN_MORE';
    const description =
      typeof raw.description === 'string' ? raw.description.trim() || null : null;
    const pixelId = typeof raw.pixelId === 'string' ? raw.pixelId.trim() || null : null;

    if (!assetId) {
      results.push({ assetId: '', ok: false, error: 'Missing assetId' });
      continue;
    }
    if (!headline) {
      results.push({ assetId, ok: false, error: 'Missing headline' });
      continue;
    }
    if (!landingUrl) {
      results.push({ assetId, ok: false, error: 'Missing landingUrl' });
      continue;
    }

    try {
      const creative = await storeAdCreativeForAsset({
        companyId: session.companyId,
        assetId,
        headline,
        primaryText: primaryText || headline,
        description,
        landingUrl,
        ctaType,
        pixelId,
        metaCampaignId: campaignId,
      });

      results.push({
        assetId,
        ok: true,
        creative: {
          id: creative.id,
          metaCreativeId: creative.metaCreativeId,
          assetId: creative.assetId,
          headline: creative.headline,
          primaryText: creative.primaryText,
          description: creative.description,
          ctaType: creative.ctaType,
          landingUrl: creative.landingUrl,
          imageHash: creative.imageHash,
          videoId: creative.videoId,
          thumbnailUrl: creative.thumbnailUrl,
        },
      });
    } catch (err) {
      const parsed = apiErrorFromUnknown(err);
      results.push({
        assetId,
        ok: false,
        error: parsed.error,
        metaError: parsed.metaError,
      });
    }
  }

  const created = results.filter((r) => r.ok).length;
  const failed = results.length - created;

  return NextResponse.json({
    results,
    summary: { total: results.length, created, failed, recreate },
  });
}
