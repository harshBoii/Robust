import 'server-only';

import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { buildCreativeRefineSystemPrompt } from '@/lib/assistant/creative-refine-prompt';
import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { creativeRefinePatchSchema } from '@/lib/assistant/schemas';
import { pickValidFields, validateFullOrPartial } from '@/lib/assistant/validate-with-retry';

export const dynamic = 'force-dynamic';

type Body = {
  messages?: unknown;
  adType?: unknown;
  tone?: unknown;
  currentCreative?: unknown;
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
        typeof (m as { content?: unknown }).content === 'string',
    )
    .map((m) => ({
      role: (m as { role: string }).role === 'assistant' ? 'assistant' : 'user',
      content: (m as { content: string }).content,
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

  const adType =
    typeof body.adType === 'string' && body.adType.trim()
      ? body.adType.trim()
      : 'OUTCOME_SALES';
  const tone =
    typeof body.tone === 'string' && body.tone.trim() ? body.tone.trim() : 'general';

  const currentCreative = body.currentCreative ?? {};
  const system = buildCreativeRefineSystemPrompt();

  const contextPrefix = `Ad type: ${adType} (optional context)\nTone: ${tone} (optional)\nCurrent creative: ${JSON.stringify(currentCreative)}\n\n`;

  const apiMessages =
    messages.length > 0
      ? messages.map((m, i) =>
          m.role === 'user' && i === messages.length - 1
            ? { ...m, content: contextPrefix + m.content }
            : m,
        )
      : [{ role: 'user' as const, content: contextPrefix + 'Refine the creative copy.' }];

  let lastZodError = '';

  for (let attempt = 1 as 1 | 2; attempt <= 2; attempt++) {
    const msgs =
      attempt === 2
        ? [
            ...apiMessages,
            {
              role: 'user' as const,
              content: `Validation failed:\n${lastZodError}\nReturn valid JSON.`,
            },
          ]
        : apiMessages;

    const content = await completeJsonChatWithHistory({
      model: 'gpt-5.5',
      system,
      messages: msgs,
    });

    const raw = parseJson(content);
    const result = validateFullOrPartial(raw, creativeRefinePatchSchema, attempt);

    if (result.data && !result.partial) {
      const d = result.data;
      return NextResponse.json({
        reply: d.reply,
        headline: d.headline,
        primaryText: d.primaryText,
        description: d.description,
        ctaType: d.ctaType,
        landingUrl: d.landingUrl,
        rationale: d.rationale ?? d.reply,
        skippedFields: [],
        partial: false,
      });
    }

    if (attempt === 1) {
      const fail = creativeRefinePatchSchema.safeParse(raw);
      if (!fail.success) lastZodError = fail.error.message;
      continue;
    }

    const { applied, skippedFields } = pickValidFields(raw, creativeRefinePatchSchema.shape);
    const reply =
      typeof (raw as Record<string, unknown>)?.reply === 'string'
        ? ((raw as Record<string, unknown>).reply as string)
        : 'Updated some fields.';

    return NextResponse.json({
      reply,
      ...applied,
      rationale:
        typeof applied.rationale === 'string'
          ? applied.rationale
          : reply,
      skippedFields,
      partial: skippedFields.length > 0,
    });
  }

  return NextResponse.json({ error: 'Failed to refine creative' }, { status: 502 });
}
