import 'server-only';

import { z } from 'zod';

import { completeJsonChat, parseLlmJson } from '@/lib/assistant/openai-json';

import { getArtistStylePrompt } from './artist-styles';
import type { BrandDnaStructured } from './brand-dna-llm-types';
import { SEEDREAM_PROMPT_MODEL } from './models';
import type { ImageGenState } from './types';

export type SeedreamPromptContext = {
  draftPrompt: string;
  artistStyle?: string | null;
  brandDnaStructured?: BrandDnaStructured | null;
  brandDnaPromptBlock?: string | null;
  productDescription?: string | null;
  brandTone?: string | null;
  aspectRatio?: string | null;
  rivalIntelligenceBrief?: string | null;
  referenceImageCount?: number;
  isEdit?: boolean;
};

const responseSchema = z.object({
  prompt: z.string().min(20).max(8000),
});

const SYSTEM = `You are a prompt engineer for ByteDance Seedream image generation (text-to-image and image-edit).

Given a draft prompt plus brand context and style vectors, write ONE final English prompt that Seedream will execute.

Rules:
- Merge brand DNA (visual, communication, audience, compliance) and artist style into vivid scene direction — never paste DNA tables verbatim.
- Style vectors include composition, lighting, background treatment, format intent, and typography guidance from the draft. Preserve creative intent while making it image-model friendly.
- When reference images are provided, instruct the model to preserve product identity from Figure 1; mention logo placement only if relevant — never as spec text.
- Human models must be Indian when people appear in the scene.
- NEVER instruct visible text showing color names (red, blue), hex codes (#0066cc), labels like Primary/Secondary/Accent, aspect-ratio notes, or design-spec metadata. Apply palette visually only.
- On-image copy is allowed only when the draft explicitly requests marketing headline/CTA text; otherwise prefer minimal or no typography.
- For edit mode (isEdit=true), focus on the requested change and keep everything else stable.
- Output a single flowing prompt paragraph or short bullet list — no JSON inside the prompt field.

Respond JSON only: { "prompt": string }`;

export function buildSeedreamContextFromImageGen(
  ig: ImageGenState,
  draftPrompt: string,
  referenceImageCount: number,
  isEdit = false,
): SeedreamPromptContext {
  return {
    draftPrompt,
    artistStyle: getArtistStylePrompt(ig.imageArtistId),
    brandDnaStructured: ig.brandDnaStructured ?? null,
    brandDnaPromptBlock: ig.brandDnaPromptBlock ?? null,
    productDescription: ig.productDescription ?? null,
    brandTone: ig.brandTone ?? null,
    aspectRatio: ig.aspectRatio ?? null,
    rivalIntelligenceBrief: ig.rivalIntelligenceBrief ?? null,
    referenceImageCount,
    isEdit,
  };
}

function buildUserPayload(context: SeedreamPromptContext): string {
  const blocks: string[] = [
    `Draft prompt:\n${context.draftPrompt.trim()}`,
    context.artistStyle ? `Artist style vector:\n${context.artistStyle}` : '',
    context.productDescription ? `Product:\n${context.productDescription}` : '',
    context.brandTone ? `Brand tone:\n${context.brandTone}` : '',
    context.aspectRatio ? `Aspect ratio intent: ${context.aspectRatio}` : '',
    context.referenceImageCount
      ? `Reference images: ${context.referenceImageCount} (Figure 1 = primary product/subject)`
      : 'Reference images: none (text-to-image)',
    context.isEdit ? 'Mode: edit — apply only the requested change.' : 'Mode: new generation',
    context.rivalIntelligenceBrief
      ? `Rival intelligence (patterns only, do not copy):\n${context.rivalIntelligenceBrief}`
      : '',
    context.brandDnaPromptBlock
      ? `Brand DNA notes (apply visually — do not render as on-image text):\n${context.brandDnaPromptBlock}`
      : '',
    context.brandDnaStructured
      ? `Brand DNA structured vectors:\n${JSON.stringify(context.brandDnaStructured)}`
      : '',
  ].filter(Boolean);

  return blocks.join('\n\n---\n\n');
}

export async function generateSeedreamPrompt(context: SeedreamPromptContext): Promise<string> {
  const draft = context.draftPrompt?.trim();
  if (!draft) return '';

  try {
    const raw = await completeJsonChat({
      model: SEEDREAM_PROMPT_MODEL,
      system: SYSTEM,
      user: buildUserPayload(context),
      maxTokens: 1200,
    });
    const parsed = responseSchema.parse(parseLlmJson(raw));
    const prompt = parsed.prompt.trim();
    return prompt.length >= 20 ? prompt : draft;
  } catch (err) {
    console.warn('[image-gen:seedream-prompt]', err instanceof Error ? err.message : err);
    return draft;
  }
}
