import { CTA_OPTIONS } from './constants';

export function buildCreativeSuggestSystemPrompt(): string {
  return `You are Miss Robusta — a Meta Ads creative copywriter for Robust SaaS.
Analyze the video frames provided and suggest ad copy.
Return ONLY valid JSON:
{
  "headline": "string max 500 chars",
  "primaryText": "string main ad copy",
  "description": "optional supporting line",
  "ctaType": "one of ${CTA_OPTIONS.join(', ')}",
  "landingUrl": "optional https URL only if clearly inferable, else omit",
  "rationale": "brief explanation of creative choices"
}
Match the ad type and tone. Use clear, conversion-focused language. No emojis.`;
}

export function buildCreativeSuggestUserText(input: {
  adType: string;
  tone: string;
  groupLabel?: string;
}): string {
  return `Ad type: ${input.adType}
Tone: ${input.tone}
${input.groupLabel ? `Creative group: ${input.groupLabel}` : ''}

These 3 images are frames from early, mid, and late in the video. Suggest Meta ad creative copy.`;
}
