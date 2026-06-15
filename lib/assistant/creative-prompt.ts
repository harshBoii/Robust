import { CTA_OPTIONS } from './constants';

export function buildCreativeSuggestSystemPrompt(): string {
  return `You are Miss Robusta — a Meta Ads creative copywriter for Robust SaaS.
Analyze the video frames provided and suggest ad copy.
Return ONLY valid JSON:
{
  "headline": "string max 500 chars",
  "primaryText": "string main ad copy",
  "description": "optional supporting line",
  "ctaType": "one of ${CTA_OPTIONS.join(', ')} — this is the button label type, NOT a URL",
  "landingUrl": "optional https destination URL for the ad click — never use CTA, button names, or placeholders; omit if unknown",
  "rationale": "brief explanation of creative choices"
}
Match the ad type and tone. Use clear, conversion-focused language. No emojis.`;
}

export function buildCreativeSuggestUserText(input: {
  adType: string;
  tone: string;
  groupLabel?: string;
  brandLandingUrl?: string;
}): string {
  return `Ad type: ${input.adType}
Tone: ${input.tone}
${input.groupLabel ? `Creative group: ${input.groupLabel}` : ''}
${input.brandLandingUrl ? `Brand landing page (use for landingUrl when appropriate): ${input.brandLandingUrl}` : ''}

These 3 images are frames from early, mid, and late in the video. Suggest Meta ad creative copy.`;
}
