import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { CLASSIFIER_MODEL } from './models';

export type PostResultNextRoute =
  | 'variants'
  | 'regenerate'
  | 'productOnModel'
  | 'newProductAd'
  | 'postToAds';

export const POST_RESULT_NEXT_OPTIONS: Array<{
  id: PostResultNextRoute;
  label: string;
  description: string;
}> = [
  {
    id: 'variants',
    label: 'Build more variants',
    description: 'Create multiple ad versions from this image',
  },
  {
    id: 'regenerate',
    label: 'Change this image',
    description: 'Adjust the brief and regenerate',
  },
  {
    id: 'productOnModel',
    label: 'Product on model',
    description: 'Photoshoot with model, background, and pose',
  },
  {
    id: 'newProductAd',
    label: 'New product ad',
    description: 'Start over with another product or upload',
  },
  {
    id: 'postToAds',
    label: 'Post to ads',
    description: 'Continue to Meta ad campaign setup',
  },
];

const schema = z.object({
  route: z.enum(['variants', 'regenerate', 'productOnModel', 'newProductAd', 'postToAds']),
});

const SYSTEM = `You decide what the user wants to do AFTER they generated a product ad image.

Routes (pick exactly one):
- "variants": more versions, A/B variants, multiple copies, variations from this image
- "regenerate": change, redo, fix, adjust, different look for THIS same ad (not a new product)
- "productOnModel": model, mannequin, wear product, photoshoot, pose, background scene with person
- "newProductAd": new product, different item, start over, another SKU, fresh hero ad from scratch
- "postToAds": publish, post to Meta, campaign, run ads, launch, schedule ads

If the user picked a button, respect the button id when it clearly matches.
Respond JSON only: { "route": "variants" | "regenerate" | "productOnModel" | "newProductAd" | "postToAds" }`;

const CHOICE_TO_ROUTE: Record<string, PostResultNextRoute> = {
  variants: 'variants',
  regenerate: 'regenerate',
  productOnModel: 'productOnModel',
  newProductAd: 'newProductAd',
  postToAds: 'postToAds',
};

export async function classifyPostResultNext(input: {
  userText: string;
  choiceId?: string | null;
}): Promise<PostResultNextRoute> {
  if (input.choiceId && input.choiceId in CHOICE_TO_ROUTE) {
    return CHOICE_TO_ROUTE[input.choiceId];
  }

  const raw = await completeJsonChat({
    model: CLASSIFIER_MODEL,
    system: SYSTEM,
    user: [
      input.choiceId ? `Button clicked: ${input.choiceId}` : null,
      `User message: ${input.userText}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  try {
    const parsed = schema.parse(JSON.parse(raw));
    return parsed.route;
  } catch {
    const lower = input.userText.toLowerCase();
    if (/post|publish|campaign|meta ad|run ad/.test(lower)) return 'postToAds';
    if (/model|photoshoot|wear|pose|mannequin/.test(lower)) return 'productOnModel';
    if (/variant|variation|copies|more version|a\/b/.test(lower)) return 'variants';
    if (/new product|another product|start over|different item/.test(lower)) return 'newProductAd';
    if (/change|redo|regenerat|fix|adjust|different/.test(lower)) return 'regenerate';
    return 'variants';
  }
}
