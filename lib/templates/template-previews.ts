import type { TemplateCategory } from './types';

const TEMPLATE_DIR = '/templates';

/** Per-template card art — filenames in public/templates matched to catalog names */
const TEMPLATE_PREVIEW: Record<string, string> = {
  'product-clean-background': `${TEMPLATE_DIR}/clean bg.png`,
  'lifestyle-context': `${TEMPLATE_DIR}/lifestyle context.png`,
  'dramatic-studio': `${TEMPLATE_DIR}/dramatic studio lighting.png`,
  'flat-lay': `${TEMPLATE_DIR}/flatlay.png`,
  'shadow-reflection': `${TEMPLATE_DIR}/shadow & reflection.png`,
  'seasonal-holiday': `${TEMPLATE_DIR}/seasonal holidays.png`,

  'extract-model': `${TEMPLATE_DIR}/female 2.avif`,
  'age-demographic': `${TEMPLATE_DIR}/demographic:age-shift.png`,
  'close-up-crops': `${TEMPLATE_DIR}/close-up crop.png`,
  'background-replacement': `${TEMPLATE_DIR}/background replacement.png`,

  'anime-illustrated': `${TEMPLATE_DIR}/anime illustrated.png`,
  'luxury-editorial': `${TEMPLATE_DIR}/luxury editorial.png`,
  'minimalist-scandinavian': `${TEMPLATE_DIR}/minimalist scandinavian.png`,
  'dark-cinematic': `${TEMPLATE_DIR}/Dark Cinematic.png`,
  'neon-cyberpunk': `${TEMPLATE_DIR}/neon cyberpunk.png`,
  'vintage-retro': `${TEMPLATE_DIR}/vintage retro.png`,
  'watercolor-sketch': `${TEMPLATE_DIR}/watercolor:sketch.png`,

  'story-vertical-safe': `${TEMPLATE_DIR}/story vertical.png`,
  'ugc-style': `${TEMPLATE_DIR}/UGC style.png`,
  'testimonial-overlay': `${TEMPLATE_DIR}/testimonial overlay zome.png`,
  'urgency-sale-banner': `${TEMPLATE_DIR}/urgency:sale banner.png`,

  'meta-feed-square': `${TEMPLATE_DIR}/meta-feed square.png`,
  'meta-story-reel': `${TEMPLATE_DIR}/meta story:reel.png`,
  'google-display-banner': `${TEMPLATE_DIR}/google display banner.png`,
};

const CATEGORY_PREVIEW: Record<TemplateCategory, string> = {
  product: TEMPLATE_PREVIEW['product-clean-background'],
  model: TEMPLATE_PREVIEW['extract-model'],
  style: TEMPLATE_PREVIEW['anime-illustrated'],
  adFormat: TEMPLATE_PREVIEW['story-vertical-safe'],
  platform: TEMPLATE_PREVIEW['meta-feed-square'],
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
