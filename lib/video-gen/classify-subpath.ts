import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { VIDEO_GEN_CLASSIFIER_MODEL } from './models';
import type { VideoGenSubpath } from './types';

const schema = z.object({
  subpath: z.enum(['mrAdicasso', 'learnAndBuild', 'replicate']),
});

const SYSTEM = `Route the user to one video ad generation subpath:
- "mrAdicasso": create a new creative video ad from scratch using brand context (Picasso of ads, masterpiece, original concept).
- "learnAndBuild": learn from their top performing ads and build a new ad from winning patterns.
- "replicate": pick an existing ad from their library and replicate its creative DNA with fresh copy.

Respond with JSON only: { "subpath": "mrAdicasso" | "learnAndBuild" | "replicate" }`;

export async function classifyVideoGenSubpath(userMessage: string): Promise<VideoGenSubpath> {
  const raw = await completeJsonChat({
    model: VIDEO_GEN_CLASSIFIER_MODEL,
    system: SYSTEM,
    user: userMessage,
  });
  try {
    return schema.parse(JSON.parse(raw)).subpath;
  } catch {
    const lower = userMessage.toLowerCase();
    if (/learn|build|top perform|winning|best ads/.test(lower)) return 'learnAndBuild';
    if (/replicat|copy|same style|like this ad|existing ad/.test(lower)) return 'replicate';
    return 'mrAdicasso';
  }
}
