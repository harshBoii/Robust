import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { CLASSIFIER_MODEL } from './models';

const schema = z.object({
  path: z.enum(['ads', 'imageGen']),
});

const SYSTEM = `You route the user's first chat message to one of two top-level paths:
- "ads": posting Meta/Facebook ads, campaigns, ad sets, publishing, scheduling, uploading creatives for ads, pixel setup, budgets.
- "imageGen": creating or generating product images, ad creative images, image variants, product-on-model photoshoots, AI image generation, Shopify product ads (visual), NOT posting to Meta.

Respond with JSON only: { "path": "ads" | "imageGen" }`;

export async function classifyTopLevelPath(userMessage: string): Promise<'ads' | 'imageGen'> {
  const raw = await completeJsonChat({
    model: CLASSIFIER_MODEL,
    system: SYSTEM,
    user: userMessage,
  });
  try {
    const parsed = schema.parse(JSON.parse(raw));
    return parsed.path;
  } catch {
    const lower = userMessage.toLowerCase();
    if (
      /generat|image|photo|variant|product ad|on model|shopify product|creative image|visual/.test(
        lower,
      ) &&
      !/post.*ad|publish|campaign|meta pixel|ad set/.test(lower)
    ) {
      return 'imageGen';
    }
    return 'ads';
  }
}
