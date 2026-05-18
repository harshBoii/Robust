import 'server-only';

import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import {
  buildPresetChatMessagesForApi,
  buildPresetChatSystemPrompt,
  resolvePresetChatAdType,
  resolvePresetChatTone,
} from '@/lib/assistant/preset-chat-prompt';
import { presetChatResponseSchema } from '@/lib/assistant/schemas';
import {
  validateFullOrPartial,
  validatePresetBuilderPartial,
} from '@/lib/assistant/validate-with-retry';

export const dynamic = 'force-dynamic';

type Body = {
  messages?: unknown;
  adType?: unknown;
  tone?: unknown;
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

function parseMessages(raw: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: string; content: string } =>
        m &&
        typeof m === 'object' &&
        (m as { role?: string }).role &&
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
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

  const messages = parseMessages(body.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser?.content.trim()) {
    return NextResponse.json({ error: 'A user message is required' }, { status: 400 });
  }

  const adType = resolvePresetChatAdType(
    typeof body.adType === 'string' ? body.adType : null,
    body.currentCampaignDraft,
  );
  const tone = resolvePresetChatTone(typeof body.tone === 'string' ? body.tone : null);

  const system = buildPresetChatSystemPrompt();
  const apiMessages = buildPresetChatMessagesForApi({
    messages,
    adType,
    tone,
    currentCampaignDraft: body.currentCampaignDraft,
    currentAdsetDraft: body.currentAdsetDraft,
  });

  let lastZodError = '';

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt++) {
    const msgs =
      attempt === 2
        ? [
            ...apiMessages,
            {
              role: 'user' as const,
              content: `Previous JSON failed validation:\n${lastZodError}\nReturn valid JSON only.`,
            },
          ]
        : apiMessages;

    const content = await completeJsonChatWithHistory({
      model: 'gpt-4o-mini',
      system,
      messages: msgs,
      maxTokens: 1600,
    });

    const raw = parseJson(content);
    const result = validateFullOrPartial(raw, presetChatResponseSchema, attempt);

    if (result.data && !result.partial) {
      const d = result.data;
      return NextResponse.json({
        reply: d.reply,
        campaign: d.campaign ?? null,
        adset: d.adset ?? null,
        explanation: d.explanation,
        skippedFields: [],
        partial: false,
      });
    }

    if (attempt === 1) {
      const fail = presetChatResponseSchema.safeParse(raw);
      if (!fail.success) lastZodError = fail.error.message;
      continue;
    }

    const part = validatePresetBuilderPartial(raw);
    const reply =
      typeof (raw as Record<string, unknown>)?.reply === 'string'
        ? ((raw as Record<string, unknown>).reply as string)
        : part.explanation || 'Updated some fields.';

    return NextResponse.json({
      reply,
      campaign: part.campaign,
      adset: part.adset,
      explanation: part.explanation,
      skippedFields: part.skippedFields,
      partial: part.skippedFields.length > 0,
    });
  }

  return NextResponse.json({ error: 'Failed to process preset chat' }, { status: 502 });
}
