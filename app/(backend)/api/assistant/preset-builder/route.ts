import 'server-only';

import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { completeJsonChat } from '@/lib/assistant/openai-json';
import {
  buildPresetBuilderSystemPrompt,
  buildPresetBuilderUserPrompt,
} from '@/lib/assistant/preset-prompt';
import { presetBuilderResponseSchema } from '@/lib/assistant/schemas';
import {
  validateFullOrPartial,
  validatePresetBuilderPartial,
} from '@/lib/assistant/validate-with-retry';

export const dynamic = 'force-dynamic';

type Body = {
  adType?: unknown;
  tone?: unknown;
  extraContext?: unknown;
  currentCampaignDraft?: unknown;
  currentAdsetDraft?: unknown;
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

  const adType = typeof body.adType === 'string' ? body.adType.trim() : '';
  const tone = typeof body.tone === 'string' ? body.tone.trim() : '';
  if (!adType || !tone) {
    return NextResponse.json({ error: 'adType and tone are required' }, { status: 400 });
  }

  const extraContext = typeof body.extraContext === 'string' ? body.extraContext.trim() : undefined;
  const system = buildPresetBuilderSystemPrompt();
  const userBase = buildPresetBuilderUserPrompt({
    adType,
    tone,
    extraContext,
    currentCampaignDraft: body.currentCampaignDraft,
    currentAdsetDraft: body.currentAdsetDraft,
  });

  let raw: unknown = null;
  let skippedFields: string[] = [];
  let partial = false;

  let lastZodError = '';

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt++) {
    const user =
      attempt === 1
        ? userBase
        : `${userBase}\n\nPrevious JSON failed validation:\n${lastZodError}\nFix and return valid JSON only.`;

    const content = await completeJsonChat({
      model: 'gpt-4o-mini',
      system,
      user,
      maxTokens: 1400,
    });

    raw = parseJson(content);
    const result = validateFullOrPartial(raw, presetBuilderResponseSchema, attempt);
    if (!result.data && attempt === 1) {
      const fail = presetBuilderResponseSchema.safeParse(raw);
      if (!fail.success) lastZodError = fail.error.message;
    }

    if (result.data && !result.partial) {
      return NextResponse.json({
        campaign: result.data.campaign ?? null,
        adset: result.data.adset ?? null,
        explanation: result.data.explanation,
        skippedFields: [],
        partial: false,
      });
    }

    if (attempt === 2) {
      const part = validatePresetBuilderPartial(raw);
      skippedFields = part.skippedFields;
      partial = skippedFields.length > 0 || Boolean(part.campaign || part.adset);
      return NextResponse.json({
        campaign: part.campaign,
        adset: part.adset,
        explanation: part.explanation || 'Some fields could not be validated.',
        skippedFields,
        partial,
      });
    }
  }

  return NextResponse.json({ error: 'Failed to generate preset suggestions' }, { status: 502 });
}
