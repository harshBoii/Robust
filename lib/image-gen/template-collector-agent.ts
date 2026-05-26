import 'server-only';

import { z } from 'zod';

import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { LLM_USER_REPLY_PRIVACY_RULES } from '@/lib/assistant/user-facing-llm-error';
import { getTemplateById } from '@/lib/templates/catalog';

import { TEMPLATE_COLLECTOR_MODEL } from './models';
import type { ImageGenState } from './types';

const MAX_NOTES_TURNS = 2;

const responseSchema = z.object({
  reply: z.string(),
  additionalRequest: z.string().optional(),
  readyToGenerate: z.boolean(),
});

export type TemplateNotesResult = {
  reply: string;
  state: Partial<ImageGenState>;
  readyToGenerate: boolean;
};

const SKIP_PHRASES = /^(no|nope|none|nothing|skip|generate|go|ok|okay|yes|looks good|good|fine|proceed|start|ready)\b/i;

function isSkipIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (SKIP_PHRASES.test(t)) return true;
  return t.length < 4 && !/[a-z]{4,}/.test(t);
}

export async function runTemplateNotesTurn(input: {
  state: ImageGenState;
  userText: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  /** First call right after upload (no user message yet) */
  afterUpload?: boolean;
}): Promise<TemplateNotesResult> {
  const def = input.state.templateId ? getTemplateById(input.state.templateId) : undefined;
  if (!def) {
    return {
      reply: 'This template session is missing its recipe. Please start again from Templates.',
      state: {},
      readyToGenerate: false,
    };
  }

  if (!input.state.productImageAssetId) {
    return {
      reply: 'Please upload your image first using the button below or the + attach control.',
      state: {},
      readyToGenerate: false,
    };
  }

  const turns = input.state.collectorTurns ?? 0;
  const existingExtra = String(input.state.templateCollectedFields?.additionalRequest ?? '').trim();

  if (!input.afterUpload && isSkipIntent(input.userText) && !existingExtra) {
    return {
      reply: 'Got it — generating with the default recipe for this template.',
      state: { collectorTurns: turns + 1 },
      readyToGenerate: true,
    };
  }

  if (!input.afterUpload && input.userText.trim() && !isSkipIntent(input.userText)) {
    const fields = {
      ...(input.state.templateCollectedFields ?? {}),
      additionalRequest: input.userText.trim(),
    };
    return {
      reply: `Got it — I'll include your notes when generating. Starting now.`,
      state: {
        templateCollectedFields: fields,
        collectorTurns: turns + 1,
      },
      readyToGenerate: true,
    };
  }

  const system = `You help users after they uploaded an image for a creative template preset.

Template: ${def.name}
What this preset does: ${def.capabilityBlurb}

The user has already uploaded their image. Your job:
1. Briefly explain what this preset will do with their image (1-2 sentences).
2. Ask if they have any additional requests (styling, background, mood, text, etc.) — or they can say "generate" / "no" to proceed with defaults.
3. Do NOT ask them to upload again. Do NOT ask about artist or quality.
4. Do NOT collect structured fields (no separate questions for color, ratio, etc.) — optional notes go in additionalRequest only.

If the user says they have no changes, or says generate/go/ready, set readyToGenerate true and additionalRequest empty.
If they describe what they want, set readyToGenerate true and put their full request in additionalRequest.
On the first message after upload (synthetic trigger), welcome them and ask for optional requests only.

${LLM_USER_REPLY_PRIVACY_RULES}

Respond JSON only:
{
  "reply": "assistant message",
  "additionalRequest": "optional string — only if user gave specific extra instructions",
  "readyToGenerate": boolean
}`;

  const userContent = input.afterUpload
    ? 'The user just uploaded their image. Greet them briefly and ask for any optional additional requests before generating.'
    : `User message: ${input.userText}`;

  const raw = await completeJsonChatWithHistory({
    model: TEMPLATE_COLLECTOR_MODEL,
    system,
    messages: [
      ...input.history.slice(-8),
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  let parsed: z.infer<typeof responseSchema>;
  try {
    parsed = responseSchema.parse(JSON.parse(raw));
  } catch {
    return {
      reply: `${def.capabilityBlurb} Any extra requests before I generate? Say what you'd like, or reply **generate** to use defaults.`,
      state: { collectorTurns: turns + 1 },
      readyToGenerate: false,
    };
  }

  const fields = { ...(input.state.templateCollectedFields ?? {}) };
  if (parsed.additionalRequest?.trim()) {
    fields.additionalRequest = parsed.additionalRequest.trim();
  }

  const readyToGenerate =
    parsed.readyToGenerate ||
    (input.afterUpload ? false : isSkipIntent(input.userText)) ||
    (turns + 1 >= MAX_NOTES_TURNS && Boolean(input.state.productImageAssetId));

  return {
    reply: parsed.reply,
    state: {
      templateCollectedFields: fields,
      collectorTurns: turns + 1,
    },
    readyToGenerate,
  };
}

/** @deprecated Use runTemplateNotesTurn */
export const runTemplateCollectorTurn = runTemplateNotesTurn;
