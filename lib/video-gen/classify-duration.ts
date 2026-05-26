import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { VIDEO_GEN_CLASSIFIER_MODEL } from './models';
import type { VideoGenDurationBucket } from './types';

const schema = z.object({
  duration: z.enum(['short', 'medium', 'long']),
});

const SYSTEM = `Map the user's natural language request to a video ad duration bucket:
- "short": within 15 seconds (e.g. "keep it short", "15 sec", "snappy")
- "medium": 15 to 40 seconds (e.g. "30 seconds", "half a minute", "medium length")
- "long": 40 to 80 seconds (e.g. "60 seconds", "long form", "full minute")

Respond with JSON only: { "duration": "short" | "medium" | "long" }`;

export async function classifyDuration(userMessage: string): Promise<VideoGenDurationBucket> {
  const raw = await completeJsonChat({
    model: VIDEO_GEN_CLASSIFIER_MODEL,
    system: SYSTEM,
    user: userMessage,
  });
  try {
    return schema.parse(JSON.parse(raw)).duration;
  } catch {
    const lower = userMessage.toLowerCase();
    if (/long|60|80|minute|full/.test(lower)) return 'long';
    if (/short|15|snappy|quick|brief/.test(lower)) return 'short';
    return 'medium';
  }
}
