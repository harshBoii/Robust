import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { CLASSIFIER_MODEL } from './models';

const schema = z.object({
  path: z.enum(['ads', 'imageGen', 'videoGen', 'geo']),
});

const SYSTEM = `You route the user's first chat message to one of four top-level paths:
- "ads": posting Meta/Facebook ads, campaigns, ad sets, publishing, scheduling, uploading creatives for ads, pixel setup, budgets.
- "imageGen": creating or generating product images, ad creative images, image variants, product-on-model photoshoots, AI image generation, Shopify product ads (visual), NOT posting to Meta.
- "videoGen": creating or generating video ads, video scripts, HeyGen video generation, UGC-style video ads, replicate/learn from winning video ads.
- "geo": organic growth, GEO/SEO/AEO, LLM citations, share of voice, GeoKnight prompts, bounties, get cited, publish blog/X/LinkedIn/Reddit, rivals, radar metrics, organic visibility — NOT Meta paid ads.

Respond with JSON only: { "path": "ads" | "imageGen" | "videoGen" | "geo" }`;

export async function classifyTopLevelPath(
  userMessage: string,
): Promise<'ads' | 'imageGen' | 'videoGen' | 'geo'> {
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
      /geo\b|aeo\b|seo\b|citation|bounty|share of voice|geoknight|organic growth|llm visibility|get cited|prompt coverage|topic authority/.test(
        lower,
      ) &&
      !/meta pixel|facebook ad|instagram ad|ad set|campaign budget/.test(lower)
    ) {
      return 'geo';
    }
    if (
      /video ad|video script|heygen|ugc video|replicate.*ad|learn.*build|mr\.? adicasso|video generat/.test(
        lower,
      ) &&
      !/post.*ad|publish|campaign|meta pixel|ad set/.test(lower)
    ) {
      return 'videoGen';
    }
    if (
      /generat|image|photo|variant|product ad|on model|shopify product|creative image|visual/.test(
        lower,
      ) &&
      !/post.*ad|publish|campaign|meta pixel|ad set|video/.test(lower)
    ) {
      return 'imageGen';
    }
    return 'ads';
  }
}
