import type { TemplateCategory } from './types';

/** Preview images served from /public/templates */
export const TEMPLATE_PREVIEW_ASSETS = {
  cleanBg: '/templates/clean bg .png',
  goodLighting: '/templates/good lighting.jpeg',
  studioLighting: '/templates/studio lighting.jpg',
  flatLay: '/templates/flat lay.png',
  reflectionShadows: '/templates/reflection and shadows.png',
  seasonalHoliday: '/templates/seasonal holiday.webp',
} as const;

const CATEGORY_PREVIEW: Record<TemplateCategory, string> = {
  product: TEMPLATE_PREVIEW_ASSETS.cleanBg,
  model: TEMPLATE_PREVIEW_ASSETS.goodLighting,
  style: TEMPLATE_PREVIEW_ASSETS.studioLighting,
  adFormat: TEMPLATE_PREVIEW_ASSETS.flatLay,
  platform: TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,
};

/** Per-template card art — product templates map 1:1 to files in public/templates */
const TEMPLATE_PREVIEW: Record<string, string> = {
  'product-clean-background': TEMPLATE_PREVIEW_ASSETS.cleanBg,
  'lifestyle-context': TEMPLATE_PREVIEW_ASSETS.goodLighting,
  'dramatic-studio': TEMPLATE_PREVIEW_ASSETS.studioLighting,
  'flat-lay': TEMPLATE_PREVIEW_ASSETS.flatLay,
  'shadow-reflection': TEMPLATE_PREVIEW_ASSETS.reflectionShadows,
  'seasonal-holiday': TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,

  'extract-model': TEMPLATE_PREVIEW_ASSETS.goodLighting,
  'age-demographic': TEMPLATE_PREVIEW_ASSETS.goodLighting,
  'close-up-crops': TEMPLATE_PREVIEW_ASSETS.goodLighting,
  'background-replacement': TEMPLATE_PREVIEW_ASSETS.cleanBg,

  'anime-illustrated': TEMPLATE_PREVIEW_ASSETS.studioLighting,
  'luxury-editorial': TEMPLATE_PREVIEW_ASSETS.studioLighting,
  'minimalist-scandinavian': TEMPLATE_PREVIEW_ASSETS.cleanBg,
  'dark-cinematic': TEMPLATE_PREVIEW_ASSETS.studioLighting,
  'neon-cyberpunk': TEMPLATE_PREVIEW_ASSETS.reflectionShadows,
  'vintage-retro': TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,
  'watercolor-sketch': TEMPLATE_PREVIEW_ASSETS.flatLay,

  'story-vertical-safe': TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,
  'ugc-style': TEMPLATE_PREVIEW_ASSETS.goodLighting,
  'testimonial-overlay': TEMPLATE_PREVIEW_ASSETS.cleanBg,
  'urgency-sale-banner': TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,

  'meta-feed-square': TEMPLATE_PREVIEW_ASSETS.flatLay,
  'meta-story-reel': TEMPLATE_PREVIEW_ASSETS.seasonalHoliday,
  'google-display-banner': TEMPLATE_PREVIEW_ASSETS.cleanBg,
};

/** Encode path segments so filenames with spaces load reliably in the browser */
export function templatePreviewSrc(path: string): string {
  return path
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

export function getTemplatePreviewImage(templateId: string, category: TemplateCategory): string {
  const path = TEMPLATE_PREVIEW[templateId] ?? CATEGORY_PREVIEW[category];
  return templatePreviewSrc(path);
}
