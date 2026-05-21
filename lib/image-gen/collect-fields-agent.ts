import 'server-only';

import { z } from 'zod';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';

import { IMAGE_COLLECTOR_MODEL, MAX_COLLECTOR_TURNS } from './models';
import type { ImageGenState } from './types';

const responseSchema = z.object({
  reply: z.string(),
  fields: z.object({
    productDescription: z.string().optional(),
    brandTone: z.string().optional(),
    copyCount: z.number().optional(),
    aspectRatio: z.string().optional(),
  }),
  complete: z.boolean(),
  agentMemory: z.string().optional(),
});

export type CollectorResult = {
  reply: string;
  state: Partial<ImageGenState>;
  complete: boolean;
};

function hasProductImage(state: ImageGenState): boolean {
  return Boolean(state.productImageAssetId || state.productImageUrl?.trim());
}

function hasRequiredFields(state: ImageGenState): boolean {
  return Boolean(
    hasProductImage(state) &&
      state.productDescription?.trim() &&
      state.brandTone?.trim() &&
      typeof state.copyCount === 'number' &&
      state.copyCount >= 1,
  );
}

const SYSTEM = `You collect fields for AI product ad image generation. Required before complete=true:
- product image (already provided via asset — do not ask again if set)
- product description
- brand tone (voice/style)
- number of copies/variants (copyCount, integer 1-8)

Optional: aspectRatio (e.g. "1:1", "16:9", "9:16", "square", "landscape", "portrait").

Rules:
- Ask at most ONE focused question per turn when fields are missing.
- If the user's message already contains missing fields, extract them and do not re-ask.
- When all required fields are present, set complete=true and reply with a brief confirmation.
- copyCount defaults to 4 for variant flows if user says "a few" without a number.

Respond JSON only:
{
  "reply": "assistant message to user",
  "fields": { "productDescription"?, "brandTone"?, "copyCount"?, "aspectRatio"? },
  "complete": boolean,
  "agentMemory": "short notes for continuity"
}`;

export async function runCollectorTurn(input: {
  state: ImageGenState;
  userText: string;
  history: { role: 'user' | 'assistant'; content: string }[];
}): Promise<CollectorResult> {
  const turns = input.state.collectorTurns ?? 0;
  const merged: ImageGenState = {
    ...input.state,
    ...(turns >= MAX_COLLECTOR_TURNS ? {} : {}),
  };

  const stateSummary = {
    hasProductImage: Boolean(merged.productImageAssetId),
    productDescription: merged.productDescription ?? null,
    brandTone: merged.brandTone ?? null,
    copyCount: merged.copyCount ?? null,
    aspectRatio: merged.aspectRatio ?? null,
    subpath: merged.subpath,
    collectorTurns: turns,
  };

  const raw = await completeJsonChatWithHistory({
    model: IMAGE_COLLECTOR_MODEL,
    system: SYSTEM,
    messages: [
      ...input.history.slice(-10),
      {
        role: 'user',
        content: `Current state: ${JSON.stringify(stateSummary)}\n\nUser: ${input.userText}`,
      },
    ],
  });

  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    return {
      reply: 'Tell me more about your product and the brand tone you want for the ad.',
      state: { collectorTurns: turns + 1 },
      complete: false,
    };
  }

  const next: ImageGenState = {
    ...merged,
    productDescription: parsed.fields.productDescription ?? merged.productDescription,
    brandTone: parsed.fields.brandTone ?? merged.brandTone,
    copyCount: parsed.fields.copyCount ?? merged.copyCount,
    aspectRatio: parsed.fields.aspectRatio ?? merged.aspectRatio,
    agentMemory: parsed.agentMemory ?? merged.agentMemory,
    collectorTurns: turns + 1,
  };

  if (parsed.fields.copyCount != null) {
    next.copyCount = Math.min(8, Math.max(1, Math.round(parsed.fields.copyCount)));
  }

  const complete =
    parsed.complete || hasRequiredFields(next) || (turns + 1 >= MAX_COLLECTOR_TURNS && hasRequiredFields(next));

  if (complete && !next.copyCount) next.copyCount = 4;

  return {
    reply: parsed.reply,
    state: next,
    complete: complete && hasRequiredFields(next),
  };
}

export function isCollectionComplete(state: ImageGenState): boolean {
  return hasRequiredFields(state);
}
