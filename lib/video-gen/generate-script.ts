import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';

import { VIDEO_SCRIPT_MODEL } from './models';
import type {
  VideoGenAdCategory,
  VideoGenCompanyContext,
  VideoGenDurationBucket,
} from './types';
import { VIDEO_GEN_AD_CATEGORIES } from './types';

const outputSchema = z.object({
  adScript: z.string().min(1),
  directorPrompt: z.string().min(1),
});

export type GeneratedVideoScript = z.infer<typeof outputSchema>;

const CREATIVE_RULES = `Creative principles (follow at least one):
- Break a popular myth to stand out
- Exaggerate a core truth
- Sell emotions, not features
- Include an "oomph" moment — hook, twist, or climax that makes the ad memorable`;

function categoryLabel(id: VideoGenAdCategory | undefined): string {
  if (!id) return 'general video ad';
  return VIDEO_GEN_AD_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function durationGuidance(bucket: VideoGenDurationBucket | undefined): string {
  if (bucket === 'short') return 'Target length: within 15 seconds. Tight pacing, one core idea.';
  if (bucket === 'long') return 'Target length: 40–80 seconds. Allow story arc and payoff.';
  if (bucket === 'medium') return 'Target length: 15–40 seconds. Balanced hook and proof.';
  return 'Target length: 15–40 seconds unless brief specifies otherwise.';
}

const SYSTEM = `You write video ad creative for two outputs:

1. adScript — clean, human-readable narrative of the ad as the viewer experiences it (dialogue, VO, on-screen beats). No camera jargon.

2. directorPrompt — dense HeyGen-ready production prompt NEVER shown to the user. Include: scene-by-scene breakdown, camera angles/movement, subject positioning, expressions/body language, lighting (natural/artificial, temperature, direction), set/background, color grading, pacing/cuts, text overlays, voiceover/dialogue cues.

${CREATIVE_RULES}

Respond with JSON only: { "adScript": "...", "directorPrompt": "..." }`;

export type GenerateScriptInput = {
  companyContext?: VideoGenCompanyContext | null;
  intelligenceBrief?: string | null;
  replicateMode?: boolean;
  adCategory?: VideoGenAdCategory;
  trendTopic?: string;
  durationBucket?: VideoGenDurationBucket;
  changeFeedback?: string;
};

export async function generateVideoScript(input: GenerateScriptInput): Promise<GeneratedVideoScript> {
  const userParts: string[] = [];

  if (input.companyContext) {
    userParts.push('## Company context\n' + JSON.stringify(input.companyContext, null, 2));
  }
  if (input.intelligenceBrief) {
    userParts.push('## Creative brief (from winning ads)\n' + input.intelligenceBrief);
  }
  if (input.replicateMode) {
    userParts.push(
      '## Task\nReplicate the creative structure and tone of the intelligence brief in a NEW non-duplicate ad.',
    );
  }
  if (input.adCategory) {
    userParts.push(`## Ad category\n${categoryLabel(input.adCategory)}`);
  }
  if (input.trendTopic) {
    userParts.push(`## Trend to build on\n${input.trendTopic}`);
  }
  userParts.push('## Duration\n' + durationGuidance(input.durationBucket));
  if (input.changeFeedback) {
    userParts.push('## User change request\n' + input.changeFeedback);
  }

  const raw = await completeJsonChat({
    model: VIDEO_SCRIPT_MODEL,
    system: SYSTEM,
    user: userParts.join('\n\n'),
  });

  const parsed = outputSchema.parse(JSON.parse(raw));
  return parsed;
}
