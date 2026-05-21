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
        content:
          'You are an expert ad creative director generating image variation briefs. JSON only.',
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
  const indices = input.changes.map((c) => c.index);

  const userText = [
    'Regenerate prompts ONLY for the listed variant indices. Keep other variants identical in ideaLabel and prompt.',
    `Changes: ${JSON.stringify(input.changes)}`,
    `Current variants: ${JSON.stringify(variants.map((v, i) => ({ index: i, ideaLabel: v.ideaLabel })))}`,
    TAXONOMY,
    'Respond JSON: { "variants": [{ "index": number, "ideaLabel": "...", "prompt": "..." }] }',
  ].join('\n');

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: userText },
    { type: 'image_url', image_url: { url: input.productImageUrl } },
  ];

  const res = await openai.chat.completions.create({
    model: VARIANT_PROMPT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Regenerate specific variant prompts. JSON only.' },
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
