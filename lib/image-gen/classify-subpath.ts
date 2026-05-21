import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { CLASSIFIER_MODEL } from './models';
import type { ImageGenSubpath } from './types';

const schema = z.object({
  subpath: z.enum(['productAd', 'variantGen', 'productOnModel']),
});

const SYSTEM = `You route image-generation requests to one subpath:
- "productAd": create a single product ad image from scratch (one hero creative).
- "variantGen": multiple ad copy / creative variants from one base image, A/B style variations, different angles.
- "productOnModel": put product on a model, photoshoot, model wearing/holding product, background and pose selection.

Respond with JSON only: { "subpath": "productAd" | "variantGen" | "productOnModel" }`;

export async function classifyImageGenSubpath(userMessage: string): Promise<ImageGenSubpath> {
  const raw = await completeJsonChat({
    model: CLASSIFIER_MODEL,
    system: SYSTEM,
    user: userMessage,
  });
  try {
    const parsed = schema.parse(JSON.parse(raw));
    return parsed.subpath;
  } catch {
    const lower = userMessage.toLowerCase();
    if (/model|on model|photoshoot|wear|holding|mannequin|pose|background/.test(lower)) {
      return 'productOnModel';
    }
    if (/variant|variations|copies|multiple|a\/b|ideas/.test(lower)) {
      return 'variantGen';
    }
    return 'productAd';
  }
}
