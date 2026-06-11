import 'server-only';

import { z } from 'zod';

import OpenAI from 'openai';

import { VARIANT_PROMPT_MODEL } from './models';
import type { ImageGenState, ImageGenVariant } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const variantSchema = z.object({
  variants: z.array(
    z.object({
      ideaLabel: z.string(),
      prompt: z.string(),
    }),
  ),
});

const VARIANT_DNA_SYSTEM =
  'You receive a Brand DNA profile (visual, communication, audience, compliance). Every variant idea and image prompt MUST align with visual colors/style, communication voice, audience persona, and compliance guardrails. Variations should explore the taxonomy axes but stay on-brand.';

const TAXONOMY = `
Variation taxonomy — each variant must target a DISTINCT axis:
1. Compositional: framing, angle, product placement, negative space
2. Lighting and color: warm/cool, high-key/low-key, color grading
3. Subject variations: focus on product detail vs lifestyle context
4. Contextual/environmental: studio, outdoor, retail, home setting
5. Text and overlay: headline placement, badge, promo strip (describe visually only)

ideaLabel: short human-readable title (max 8 words), shown to user.
prompt: detailed image generation prompt (never shown to user).
`;

export async function generateVariantPrompts(input: {
  state: ImageGenState;
  userIntention?: string;
  productImageUrl: string;
}): Promise<ImageGenVariant[]> {
  const count = Math.min(8, Math.max(1, input.state.copyCount ?? 4));

  const userText = [
    `Generate exactly ${count} distinct image variation prompts.`,
    TAXONOMY,
    input.state.productDescription ? `Product: ${input.state.productDescription}` : '',
    input.state.brandTone ? `Brand tone: ${input.state.brandTone}` : '',
    input.state.aspectRatio ? `Aspect ratio: ${input.state.aspectRatio}` : '',
    input.userIntention ? `User intention: ${input.userIntention}` : '',
    input.state.agentMemory ? `Session notes: ${input.state.agentMemory}` : '',
    input.state.brandDnaPromptBlock ?? '',
    input.state.brandDnaStructured
      ? `Brand DNA (structured — honor all constraints when generating ideas):\n${JSON.stringify(input.state.brandDnaStructured)}`
      : '',
    input.state.rivalIntelligenceBrief
      ? `Rival competitive intelligence:\n${input.state.rivalIntelligenceBrief}`
      : '',
    'Each prompt must embed relevant Visual DNA tokens (palette hex, visual emotion, corner/shadow style) and Compliance negatives inline where applicable.',
    'Respond JSON: { "variants": [{ "ideaLabel": "...", "prompt": "..." }] }',
  ]
    .filter(Boolean)
    .join('\n');

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: userText },
    { type: 'image_url', image_url: { url: input.productImageUrl } },
  ];

  const res = await openai.chat.completions.create({
    model: VARIANT_PROMPT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an expert ad creative director generating image variation briefs. JSON only. ${VARIANT_DNA_SYSTEM}`,
      },
      { role: 'user', content },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  const parsed = variantSchema.parse(JSON.parse(raw));
  return parsed.variants.slice(0, count).map((v) => ({
    ideaLabel: v.ideaLabel,
    prompt: v.prompt,
    status: 'pending' as const,
  }));
}

export async function regenerateVariantPrompts(input: {
  state: ImageGenState;
  productImageUrl: string;
  changes: Array<{ index: number; description: string }>;
}): Promise<ImageGenVariant[]> {
  const variants = [...(input.state.variants ?? [])];

  const changesWithContext = input.changes
    .filter((c) => c.index >= 0 && c.index < variants.length && c.description?.trim())
    .map((c) => ({
      index: c.index,
      promptNumber: c.index + 1,
      existingIdeaLabel: variants[c.index]!.ideaLabel,
      existingPrompt: variants[c.index]!.prompt,
      userRequest: c.description.trim(),
    }));

  if (!changesWithContext.length) {
    return variants;
  }

  const userText = [
    'Rewrite image-generation prompts ONLY for the listed prompt numbers.',
    'For each item you receive the EXISTING prompt and the USER change request — produce a new prompt that applies the request while keeping the same creative axis unless the user asks otherwise.',
    'Keep all other variant indices identical (same ideaLabel and prompt).',
    `Changes: ${JSON.stringify(changesWithContext, null, 2)}`,
    `All variants (0-based index): ${JSON.stringify(
      variants.map((v, i) => ({
        index: i,
        promptNumber: i + 1,
        ideaLabel: v.ideaLabel,
        prompt: v.prompt,
      })),
      null,
      2,
    )}`,
    TAXONOMY,
    input.state.brandDnaPromptBlock ?? '',
    input.state.brandDnaStructured
      ? `Brand DNA (structured — honor all constraints):\n${JSON.stringify(input.state.brandDnaStructured)}`
      : '',
    'Respond JSON: { "variants": [{ "index": number, "ideaLabel": "...", "prompt": "..." }] }',
  ]
    .filter(Boolean)
    .join('\n');

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: userText },
    { type: 'image_url', image_url: { url: input.productImageUrl } },
  ];

  const res = await openai.chat.completions.create({
    model: VARIANT_PROMPT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Regenerate specific variant prompts. JSON only. ${VARIANT_DNA_SYSTEM}`,
      },
      { role: 'user', content },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  const patchSchema = z.object({
    variants: z.array(
      z.object({
        index: z.number(),
        ideaLabel: z.string(),
        prompt: z.string(),
      }),
    ),
  });
  const parsed = patchSchema.parse(JSON.parse(raw));

  for (const p of parsed.variants) {
    if (p.index >= 0 && p.index < variants.length) {
      variants[p.index] = {
        ...variants[p.index],
        ideaLabel: p.ideaLabel,
        prompt: p.prompt,
        status: 'pending',
        assetId: undefined,
        imageUrl: undefined,
        error: undefined,
      };
    }
  }

  return variants;
}
