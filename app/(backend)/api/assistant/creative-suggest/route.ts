import 'server-only';

import { NextResponse } from 'next/server';

import { AssetType } from '@/app/generated/prisma/enums';
import { getSession } from '@/lib/auth/session';
import { buildStreamThumbnailUrls } from '@/lib/assistant/build-stream-thumbnails';
import {
  buildCreativeSuggestSystemPrompt,
  buildCreativeSuggestUserText,
} from '@/lib/assistant/creative-prompt';
import {
  assertCreativeSuggestAllowed,
  CreativeRateLimitError,
} from '@/lib/assistant/creative-rate-limit';
import { completeVisionJsonChat } from '@/lib/assistant/openai-json';
import { creativeSuggestResponseSchema } from '@/lib/assistant/schemas';
import {
  validateCreativePartial,
  validateFullOrPartial,
} from '@/lib/assistant/validate-with-retry';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type Body = {
  assetId?: unknown;
  adType?: unknown;
  tone?: unknown;
  groupLabel?: unknown;
};

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

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

  const effectiveAdType = adType || 'OUTCOME_SALES';
  const effectiveTone = tone || 'general';

  try {
    await assertCreativeSuggestAllowed(session.companyId);
  } catch (err) {
    if (err instanceof CreativeRateLimitError) {
      return NextResponse.json({ error: err.message, remaining: 0 }, { status: 429 });
    }
    throw err;
  }

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, companyId: session.companyId },
    select: {
      id: true,
      assetType: true,
      streamId: true,
      duration: true,
      thumbnailUrl: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const system = buildCreativeSuggestSystemPrompt();
  const userText = buildCreativeSuggestUserText({
    adType: effectiveAdType,
    tone: effectiveTone,
    groupLabel,
  });

  let imageUrls: string[] = [];
  if (asset.assetType === AssetType.VIDEO) {
    if (!asset.streamId || !asset.duration) {
      return NextResponse.json(
        { error: 'Video is still processing. Try again in a minute.' },
        { status: 409 },
      );
    }
    imageUrls = buildStreamThumbnailUrls(asset.streamId, asset.duration);
  } else if (asset.thumbnailUrl) {
    imageUrls = [asset.thumbnailUrl];
  } else {
    return NextResponse.json({ error: 'No visual available for this asset' }, { status: 400 });
  }

  let raw: unknown = null;
  let lastZodError = '';

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt++) {
    const content = await completeVisionJsonChat({
      system,
      userText:
        attempt === 1
          ? userText
          : `${userText}\n\nPrevious JSON failed validation:\n${lastZodError}\nReturn valid JSON only.`,
      imageUrls,
    });

    raw = parseJson(content);
    const result = validateFullOrPartial(raw, creativeSuggestResponseSchema, attempt);
    if (!result.data && attempt === 1) {
      const fail = creativeSuggestResponseSchema.safeParse(raw);
      if (!fail.success) lastZodError = fail.error.message;
    }

    if (result.data && !result.partial) {
      console.log('[chats:creative-ai] creative-suggest ok', {
        assetId,
        headline: result.data.headline?.slice(0, 40),
      });
      return NextResponse.json({
        ...result.data,
        skippedFields: [] as string[],
        partial: false,
      });
    }

    if (attempt === 2) {
      const part = validateCreativePartial(raw);
      if (part.data) {
        return NextResponse.json({
          headline: part.data.headline ?? '',
          primaryText: part.data.primaryText ?? '',
          description: part.data.description,
          ctaType: part.data.ctaType ?? 'LEARN_MORE',
          landingUrl: part.data.landingUrl,
          rationale: typeof (raw as Record<string, unknown>)?.rationale === 'string'
            ? ((raw as Record<string, unknown>).rationale as string)
            : 'Partial suggestions applied.',
          skippedFields: part.skippedFields,
          partial: true,
        });
      }
    }
  }

  return NextResponse.json({ error: 'Failed to generate creative suggestions' }, { status: 502 });
}
