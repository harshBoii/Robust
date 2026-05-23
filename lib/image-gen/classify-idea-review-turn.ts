import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { CLASSIFIER_MODEL } from './models';
import type { ImageGenVariant } from './types';

export type IdeaReviewChange = { index: number; description: string };

export type IdeaReviewTurnResult =
  | { intent: 'accept_all' }
  | { intent: 'apply_changes'; changes: IdeaReviewChange[] }
  | { intent: 'unclear'; reply: string };

const responseSchema = z.object({
  intent: z.enum(['accept_all', 'apply_changes', 'unclear']),
  changes: z
    .array(
      z.object({
        promptNumber: z.number().int(),
        description: z.string(),
      }),
    )
    .optional(),
  clarifyingReply: z.string().optional(),
});

function formatPromptList(variants: ImageGenVariant[]): string {
  return variants
    .map(
      (v, i) =>
        `Prompt ${i + 1} — ${v.ideaLabel}\n${v.prompt}`,
    )
    .join('\n\n');
}

function clampChanges(
  raw: Array<{ promptNumber: number; description: string }>,
  variantCount: number,
): IdeaReviewChange[] {
  const out: IdeaReviewChange[] = [];
  const seen = new Set<number>();
  for (const c of raw) {
    const desc = c.description?.trim();
    if (!desc) continue;
    const n = c.promptNumber;
    if (!Number.isFinite(n) || n < 1 || n > variantCount) continue;
    const index = n - 1;
    if (seen.has(index)) continue;
    seen.add(index);
    out.push({ index, description: desc });
  }
  return out;
}

function fallbackParseIdeaReview(userText: string, variantCount: number): IdeaReviewTurnResult {
  const t = userText.trim();
  if (!t) {
    return {
      intent: 'unclear',
      reply:
        'Say which prompt to change (e.g. "change prompt 1 to a warmer studio look") or "accept all" to generate.',
    };
  }

  if (
    /^(accept all|accept\b|approve|generate all|generate\b|go ahead|looks good|yes\b|proceed\b)/i.test(
      t,
    )
  ) {
    return { intent: 'accept_all' };
  }

  const changes: IdeaReviewChange[] = [];
  const globalRe =
    /(?:change|update|edit|modify|rewrite)\s+(?:prompt|idea|variant)\s*#?\s*(\d+)\s*(?:to|:|-)\s*(.+)/gi;
  let m: RegExpExecArray | null;
  while ((m = globalRe.exec(t)) !== null) {
    const n = parseInt(m[1], 10);
    const desc = m[2]?.trim();
    if (n >= 1 && n <= variantCount && desc) {
      changes.push({ index: n - 1, description: desc.replace(/[.,;]+$/, '').trim() });
    }
  }

  if (!changes.length) {
    const simple = t.match(/(?:prompt|idea|variant)\s*#?\s*(\d+)\s*(?:to|:|-)\s*(.+)/i);
    if (simple) {
      const n = parseInt(simple[1], 10);
      const desc = simple[2]?.trim();
      if (n >= 1 && n <= variantCount && desc) {
        changes.push({ index: n - 1, description: desc.replace(/[.,;]+$/, '').trim() });
      }
    }
  }

  if (changes.length) {
    return { intent: 'apply_changes', changes };
  }

  return {
    intent: 'unclear',
    reply:
      'Use prompt numbers 1–' +
      variantCount +
      ' (e.g. "change prompt 2 to outdoor lifestyle") or say "accept all".',
  };
}

export async function classifyIdeaReviewTurn(input: {
  userText: string;
  variants: ImageGenVariant[];
}): Promise<IdeaReviewTurnResult> {
  const variantCount = input.variants.length;
  if (variantCount === 0) {
    return { intent: 'unclear', reply: 'No variant prompts to review yet.' };
  }

  const fallback = fallbackParseIdeaReview(input.userText, variantCount);

  try {
    const raw = await completeJsonChat({
      model: CLASSIFIER_MODEL,
      system: `You parse user messages during VARIANT PROMPT REVIEW before image generation.

Prompts are numbered 1 to ${variantCount} (user-facing "prompt 1" = promptNumber 1).

intents:
- "accept_all": user approves all prompts and wants images generated (accept, approve, generate, go, looks good, proceed).
- "apply_changes": user wants to change one or more prompts. For each change set promptNumber (1-based) and description (what they want instead / how to revise).
- "unclear": cannot map to accept or specific prompt edits.

Rules:
- Map "prompt 1", "idea 2", "variant 3" to promptNumber 1, 2, 3.
- Extract the full change request into description even if phrased as "make prompt 1 more minimal".
- Multiple changes in one message → multiple entries in changes.
- Do not invent prompt numbers outside 1..${variantCount}.

Respond JSON only:
{ "intent": "accept_all" | "apply_changes" | "unclear", "changes"?: [{ "promptNumber": number, "description": string }], "clarifyingReply"?: string }`,
      user: [
        'Current prompts:',
        formatPromptList(input.variants),
        '',
        `User message: ${input.userText}`,
      ].join('\n'),
    });

    const parsed = responseSchema.parse(JSON.parse(raw));

    if (parsed.intent === 'accept_all') {
      return { intent: 'accept_all' };
    }

    if (parsed.intent === 'apply_changes') {
      const changes = clampChanges(parsed.changes ?? [], variantCount);
      if (changes.length) {
        return { intent: 'apply_changes', changes };
      }
      return fallback.intent === 'apply_changes'
        ? fallback
        : {
            intent: 'unclear',
            reply:
              parsed.clarifyingReply?.trim() ||
              'Tell me which prompt number to change and what you want instead.',
          };
    }

    return {
      intent: 'unclear',
      reply:
        parsed.clarifyingReply?.trim() ||
        (fallback.intent === 'unclear' ? fallback.reply : 'Tell me which prompt to change or say "accept all".'),
    };
  } catch {
    return fallback;
  }
}
