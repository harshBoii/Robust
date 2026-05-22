import type { ImageGenState } from '@/lib/image-gen/types';

import { buildPromptForTemplate } from './build-generation-prompt';
import type { TemplateCategory, TemplateDefinition } from './types';

export { TEMPLATE_CATEGORIES } from './types';
export type { TemplateCategory, TemplateDefinition } from './types';

function def(
  partial: Omit<TemplateDefinition, 'buildGenerationPrompt' | 'outputMode'> &
    Pick<TemplateDefinition, 'id'>,
): TemplateDefinition {
  return {
    ...partial,
    capabilityBlurb: partial.capabilityBlurb ?? partial.description,
    outputMode: 'single',
    buildGenerationPrompt: (state, index) =>
      buildPromptForTemplate(
        {
          ...partial,
          capabilityBlurb: partial.capabilityBlurb ?? partial.description,
          outputMode: 'single',
          buildGenerationPrompt: () => '',
        },
        state,
        index,
      ),
  };
}

export const TEMPLATE_CATALOG: TemplateDefinition[] = [
  def({
    id: 'product-clean-background',
    name: 'Clean background product shot',
    description: 'Professional e-commerce product on an isolated background.',
    capabilityBlurb:
      'Turns your product photo into a clean, studio-quality shot on an isolated background — ideal for Amazon, Shopify, and catalog listings.',
    category: 'product',
  }),
  def({
    id: 'lifestyle-context',
    name: 'Lifestyle context',
    description: 'Product placed naturally in a lifestyle scene.',
    capabilityBlurb:
      'Places your product in a natural lifestyle scene so it feels real in context — kitchens, desks, outdoors, and more.',
    category: 'product',
  }),
  def({
    id: 'dramatic-studio',
    name: 'Dramatic studio lighting',
    description: 'High-contrast studio-lit product hero shot.',
    capabilityBlurb:
      'Creates a bold, studio-lit hero image with dramatic shadows and contrast — great for premium or luxury positioning.',
    category: 'product',
  }),
  def({
    id: 'flat-lay',
    name: 'Flat lay',
    description: 'Overhead flat lay composition with surface and props.',
    capabilityBlurb:
      'Builds a polished overhead flat lay with your product as the hero — perfect for social, lookbooks, and editorial grids.',
    category: 'product',
  }),
  def({
    id: 'shadow-reflection',
    name: 'Shadow & reflection',
    description: 'Product with realistic shadow or reflection effect.',
    capabilityBlurb:
      'Adds realistic shadows or reflections under your product so it looks grounded and premium on any surface.',
    category: 'product',
  }),
  def({
    id: 'seasonal-holiday',
    name: 'Seasonal / holiday',
    description: 'Seasonally themed product presentation.',
    capabilityBlurb:
      'Wraps your product in seasonal or holiday theming — winter, summer, Black Friday, and more — without reshooting.',
    category: 'product',
  }),

  def({
    id: 'extract-model',
    name: 'Extract model',
    description: 'Remove background and isolate the subject.',
    capabilityBlurb:
      'Cuts out a person or model from the background with clean edges — ready for a new scene or transparent export.',
    category: 'model',
  }),
  def({
    id: 'age-demographic',
    name: 'Age / demographic shift',
    description: 'Shift apparent age while preserving identity.',
    capabilityBlurb:
      'Adjusts how old or young the subject appears while keeping the same person recognizable — useful for audience targeting.',
    category: 'model',
  }),
  def({
    id: 'close-up-crops',
    name: 'Close-up crop',
    description: 'Tight crop on face, hands, product detail, or full body.',
    capabilityBlurb:
      'Produces a tight, ad-ready close-up from your photo — face, hands, product detail, or full body (mention focus in optional notes).',
    category: 'model',
  }),
  def({
    id: 'background-replacement',
    name: 'Background replacement',
    description: 'Replace background while preserving the subject.',
    capabilityBlurb:
      'Swaps the background for anything you describe — studio, outdoor, branded color — while keeping the subject sharp.',
    category: 'model',
  }),

  def({
    id: 'anime-illustrated',
    name: 'Anime / illustrated',
    description: 'Convert to anime or illustrated style.',
    capabilityBlurb:
      'Transforms your photo into anime or illustrated art while keeping the subject readable and on-brand.',
    category: 'style',
  }),
  def({
    id: 'luxury-editorial',
    name: 'Luxury editorial',
    description: 'High-fashion editorial color and composition.',
    capabilityBlurb:
      'Applies a high-fashion editorial look — refined color, contrast, and composition like a magazine spread.',
    category: 'style',
  }),
  def({
    id: 'minimalist-scandinavian',
    name: 'Minimalist Scandinavian',
    description: 'Clean Nordic aesthetic with negative space.',
    capabilityBlurb:
      'Gives your image a calm Scandinavian feel — lots of negative space, neutral tones, and quiet elegance.',
    category: 'style',
  }),
  def({
    id: 'dark-cinematic',
    name: 'Dark cinematic',
    description: 'Moody cinematic color grade and atmosphere.',
    capabilityBlurb:
      'Grades your image with a moody, cinematic palette — deep shadows, filmic color, and atmosphere.',
    category: 'style',
  }),
  def({
    id: 'neon-cyberpunk',
    name: 'Neon cyberpunk',
    description: 'Neon-lit cyberpunk night scene treatment.',
    capabilityBlurb:
      'Pushes your image into a neon cyberpunk night scene — glowing accents, urban mood, high impact.',
    category: 'style',
  }),
  def({
    id: 'vintage-retro',
    name: 'Vintage retro',
    description: 'Retro film look with grain and color effects.',
    capabilityBlurb:
      'Adds vintage film character — grain, faded color, and retro warmth — without losing your subject.',
    category: 'style',
  }),
  def({
    id: 'watercolor-sketch',
    name: 'Watercolor / sketch',
    description: 'Hand-drawn watercolor, pencil, ink, or charcoal style.',
    capabilityBlurb:
      'Renders your image as watercolor, pencil, ink, or charcoal while keeping the subject recognizable.',
    category: 'style',
  }),

  def({
    id: 'story-vertical-safe',
    name: 'Story vertical (safe zones)',
    description: '9:16 story with headline and CTA safe zones.',
    capabilityBlurb:
      'Formats your creative as a 9:16 story with safe zones reserved for headline and CTA overlays.',
    category: 'adFormat',
    fixedAspectRatio: '9:16',
  }),
  def({
    id: 'ugc-style',
    name: 'UGC style',
    description: 'Authentic phone-camera customer aesthetic.',
    capabilityBlurb:
      'Makes your product look like authentic UGC — shot on a phone, real and unpolished in a good way.',
    category: 'adFormat',
  }),
  def({
    id: 'testimonial-overlay',
    name: 'Testimonial overlay zone',
    description: 'Image with clean zone for quote overlay.',
    capabilityBlurb:
      'Prepares your image with a clean area for testimonial or quote text — great for social proof ads.',
    category: 'adFormat',
  }),
  def({
    id: 'urgency-sale-banner',
    name: 'Urgency / sale banner',
    description: 'Sale or urgency banner with offer and CTA.',
    capabilityBlurb:
      'Composes a sale or urgency banner around your product — mention offer copy in optional notes.',
    category: 'adFormat',
  }),

  def({
    id: 'meta-feed-square',
    name: 'Meta feed square',
    description: '1:1 square crop optimized for Meta feed.',
    capabilityBlurb:
      'Reframes your image as a 1:1 Meta feed square with the subject centered and cropped for scroll-stopping feed ads.',
    category: 'platform',
    fixedAspectRatio: '1:1',
  }),
  def({
    id: 'meta-story-reel',
    name: 'Meta story / reel',
    description: '9:16 vertical with safe margins for Meta stories.',
    capabilityBlurb:
      'Optimizes your image for Meta stories and reels — 9:16 vertical with safe margins for stickers and text.',
    category: 'platform',
    fixedAspectRatio: '9:16',
  }),
  def({
    id: 'google-display-banner',
    name: 'Google Display banner',
    description: 'Standard Google Display Network banner sizes.',
    capabilityBlurb:
      'Adapts your image into a Google Display–ready banner layout — mention size or headline in optional notes.',
    category: 'platform',
  }),
];

export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATE_CATALOG.find((t) => t.id === id);
}

export function listTemplatesByCategory(category: TemplateCategory): TemplateDefinition[] {
  return TEMPLATE_CATALOG.filter((t) => t.category === category);
}

export function resolveParallelCount(def: TemplateDefinition, _state: ImageGenState): number {
  return def.outputMode === 'parallel' ? 1 : 1;
}

export function templateHasRequiredAssets(
  _def: TemplateDefinition,
  state: ImageGenState,
): boolean {
  return Boolean(state.productImageAssetId);
}
