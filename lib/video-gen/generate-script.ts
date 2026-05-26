import 'server-only';

import { z } from 'zod';

import { completeJsonResponses, parseLlmJson } from '@/lib/assistant/openai-json';

import { VIDEO_SCRIPT_MODEL, VIDEO_SCRIPT_REASONING_EFFORT } from './models';
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
  Example: While brands like Fair & Lovely promoted brighter complexion as better, Dove positioned itself around beauty existing in all skin tones.

- Exaggerate a core truth
  Example: Happydent portrayed teeth glowing like LED lights; Five Star showed people so immersed in chocolate they forgot what they were doing.

- Sell emotions, not features
  Tata Tea never merely sold tea — it sold opinions, awareness, motivation, and perseverance. The product became associated with meaningful moments in daily struggles and achievements.

- Use contrast or irony — show the product solving a problem the audience didn't know they had, or flip a mundane situation into something unexpected.
  Example: Fevicol and Amul ads consistently find humor and surprise in everyday scenarios.

- Include an "oomph" moment — a hook, twist, or climax that makes the ad memorable.

Strategy vs execution note: "Break a myth", "Sell emotions", and "Use contrast/irony" are brand strategy choices. "Exaggerate a core truth" and "Oomph moment" are execution techniques. Choose the strategy first, then apply an execution technique on top of it.`;

const AUDIENCE_RULES = `Audience & tone (India):
- Write for an Indian audience: culturally legible settings, relatable daily-life contexts, and natural Indian English or light Hinglish only when it genuinely fits the brand.
  - Bad Hinglish (forced): "Yaar, try karo na!" — Good (natural): "Ek baar try karo"
  - Avoid forced slang or performative desi-ness.

- Humor, family, festivals, value-for-money, trust, and aspiration should feel authentic to India — not generic Western tropes.

- Keep claims compliant and believable for Indian viewers.

- Regional specificity is an optional lever — North India (Delhi/UP), metro (Mumbai/Bengaluru), or pan-India. The emotional register shifts meaningfully across these; default to pan-India unless the brief specifies otherwise.`;

const HEYGEN_DIRECTOR_RULES = `HeyGen directorPrompt requirements (critical):

Voice:
- Specify Indian accent / Indian voice for all narration and dialogue.

Motion (non-negotiable):
- Open with cinematic B-roll or a motion-led hook: dynamic camera move, product in action, street/market/home context — never a static hold.
- The entire video must be motion-native: NO static images, still photos, slideshows, Ken Burns on photos, freeze frames, or card/PPT-style slides anywhere.
- Every scene must describe moving subjects, camera motion, or environmental motion. Use cuts and pacing that feel like a filmed ad, not a deck of images.
- Enforcement rule: every scene description must end with a motion verb or camera action (pan, track, cut, zoom, walk, pour, etc.). If you cannot describe motion in a scene, merge it with the next one.

Aspect ratio:
- Default to 9:16 (vertical) for Meta Reels and Stories placements — tight subject framing, close cuts, fast pacing.
- Use 16:9 only if the brief explicitly calls for feed/YouTube.

Pacing & duration:
- for each 15–30 seconds length Use 4–6 scenes..
- Each scene should earn its place — if it doesn't advance the emotion or the story beat, cut it.`;

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

1. adScript — clean, human-readable narrative of the ad as the viewer experiences it (dialogue, VO, on-screen beats). Tailored for Indian viewers. No camera jargon.

2. directorPrompt — dense HeyGen-ready production prompt NEVER shown to the user. Include: scene-by-scene breakdown, camera angles/movement, subject positioning, expressions/body language, lighting (natural/artificial, temperature, direction), set/background, color grading, pacing/cuts, text overlays, voiceover/dialogue cues.

${CREATIVE_RULES}

${AUDIENCE_RULES}

${HEYGEN_DIRECTOR_RULES}

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

  const raw = await completeJsonResponses({
    model: VIDEO_SCRIPT_MODEL,
    reasoning: { effort: VIDEO_SCRIPT_REASONING_EFFORT },
    system: SYSTEM,
    user: userParts.join('\n\n'),
  });

  const parsed = outputSchema.parse(parseLlmJson(raw));
  return parsed;
}
