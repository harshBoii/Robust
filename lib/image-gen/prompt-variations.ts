export const COMPOSITIONS = [
  'product placed in the lower-left third, bold typographic headline filling the upper-right',
  'extreme close-up crop on product texture, brand name in thin letters at bottom edge',
  'flat-lay overhead shot, product centered among complementary props on textured surface',
  'product floating with dramatic shadow cast on a single-color wall behind it',
  'product held by a hand entering from screen-right, lifestyle context visible',
  'product small in frame, large negative space filled with a single bold copy line',
  'split-frame: product on left half, bold benefit statement on right half',
  'product shot from low angle looking up, sky or plain gradient as background',
  'product in motion blur, suggesting speed or pour/splash',
  'tight grid of product variants or flavors, equal spacing, no text except brand mark',
] as const;

export const LIGHTING_MOODS = [
  'hard rim lighting with deep shadows, dramatic and contrasty',
  'soft diffused window light, natural and editorial',
  'neon accent lighting, one vivid color spilling across the product',
  'golden hour warmth, rich amber tones',
  'stark minimalist studio light, pure white background, no shadows',
  'moody low-key lighting, dark background, single spotlight',
  'high-key bright and airy, pastel tones, feels premium and clean',
] as const;

export const BACKGROUND_TREATMENTS = [
  'solid bold color background matching brand palette',
  'abstract ink wash or watercolor texture background',
  'blurred lifestyle environment as background (out-of-focus kitchen / shelf / street)',
  'gradient from brand primary to dark, product floating in center',
  'raw concrete or linen texture background, editorial feel',
  'white seamless with minimal colored geometric shapes',
  'paper collage or torn-edge graphic elements in background',
] as const;

export const AD_FORMATS = [
  'designed as a scroll-stopping Instagram feed post',
  'designed as a performance-driven Meta feed ad',
  'designed as a high-impact story or reel thumbnail',
  'designed as a bold direct-response ad with visible offer',
  'designed as a premium brand awareness creative, minimal copy',
] as const;

export const TEXT_LAYOUTS = [
  'text treatment: logo mark only, no headline or body copy — let the product speak',
  'text treatment: brand name in small caps at bottom edge only, nothing else',
  'text treatment: single 2-3 word headline in large type, no supporting copy, no price',
  'text treatment: bold headline top-aligned, product name beneath it, logo bottom-right corner',
  'text treatment: headline on left side vertically, product occupies right two-thirds',
  'text treatment: offer or benefit as oversized number (e.g. \'3X\', \'₹299\', \'100%\') dominating upper area, small descriptor below',
  'text treatment: headline split across two lines with a visual break between them, logo tucked bottom-left',
  'text treatment: headline + one-line subtext + CTA button visible, stacked left-aligned',
  'text treatment: bold problem statement at top, product in middle, solution line at bottom — three-row layout',
  'text treatment: social proof line at top (\'10L+ customers\'), product center, price + CTA bottom strip',
] as const;

export const TEXT_STYLES = [
  'typography style: serif editorial font, high contrast weight — thin body, ultra-bold headline',
  'typography style: clean geometric sans-serif, uniform weight, lots of tracking',
  'typography style: handwritten accent font for headline, clean sans for supporting text',
  'typography style: condensed bold all-caps headline, small regular-weight descriptor',
  'typography style: oversized single word as background texture behind product, semi-transparent',
  'typography style: outlined/stroke text only — no filled letterforms',
] as const;

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function buildVariationBlock(): string {
  return [
    `Composition: ${pickRandom(COMPOSITIONS)}`,
    `Lighting mood: ${pickRandom(LIGHTING_MOODS)}`,
    `Background: ${pickRandom(BACKGROUND_TREATMENTS)}`,
    pickRandom(TEXT_LAYOUTS),
    pickRandom(TEXT_STYLES),
    `Format intent: ${pickRandom(AD_FORMATS)}`,
  ].join('\n');
}
