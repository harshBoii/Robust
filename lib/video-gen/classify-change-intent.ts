import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { VIDEO_GEN_CLASSIFIER_MODEL } from './models';
import type { VideoGenAdCategory, VideoGenDurationBucket } from './types';

const schema = z.object({
  action: z.enum([
    'regenerate',
    'tweakScript',
    'changeCategory',
    'changeDuration',
    'clarify',
  ]),
  assistantReply: z.string().optional(),
  newCategory: z
    .enum([
      'beforeAfter',
      'pov',
      'ugc',
      'productReview',
      'discountOffer',
      'directComparison',
      'qa',
      'painPoint',
      'trendInduced',
    ])
    .optional(),
  newDuration: z.enum(['short', 'medium', 'long']).optional(),
});

export type VideoGenChangeIntent = z.infer<typeof schema>;

const SYSTEM = `The user is reviewing a video ad script and requested changes. Classify their intent:
- "regenerate": full rewrite from scratch
- "tweakScript": adjust tone, hook, pacing, or lines while keeping same category/duration
- "changeCategory": they want a different ad type/format
- "changeDuration": they want shorter/longer
- "clarify": ask one short clarifying question (set assistantReply)

Optional: newCategory, newDuration if clearly stated.

Respond with JSON only.`;

export async function classifyChangeIntent(
  userMessage: string,
  context: { adScript?: string; adCategory?: string; durationBucket?: string },
): Promise<VideoGenChangeIntent> {
  const raw = await completeJsonChat({
    model: VIDEO_GEN_CLASSIFIER_MODEL,
    system: SYSTEM,
    user: JSON.stringify({ userMessage, ...context }),
  });
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    const lower = userMessage.toLowerCase();
    if (/duration|longer|shorter|seconds|30 sec/.test(lower)) {
      return { action: 'changeDuration' };
    }
    if (/category|format|ugc|pov|before|trend/.test(lower)) {
      return { action: 'changeCategory' };
    }
    if (/start over|regenerat|from scratch/.test(lower)) {
      return { action: 'regenerate' };
    }
    return { action: 'tweakScript' };
  }
}

export function intentCategory(
  c: VideoGenChangeIntent['newCategory'],
): VideoGenAdCategory | undefined {
  return c;
}

export function intentDuration(
  d: VideoGenChangeIntent['newDuration'],
): VideoGenDurationBucket | undefined {
  return d;
}
