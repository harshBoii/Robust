import type { ImageGenState } from '@/lib/image-gen/types';

export type TemplateCategory =
  | 'product'
  | 'model'
  | 'style'
  | 'adFormat'
  | 'platform';

export type TemplateOutputMode = 'single' | 'parallel';

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  /** Shown in intro + post-upload LLM context */
  capabilityBlurb: string;
  category: TemplateCategory;
  outputMode: TemplateOutputMode;
  fixedAspectRatio?: string | null;
  buildGenerationPrompt: (state: ImageGenState, index?: number) => string;
};

export const TEMPLATE_CATEGORIES: Array<{ id: TemplateCategory; label: string }> = [
  { id: 'product', label: 'Product-focused' },
  { id: 'model', label: 'Model & person' },
  { id: 'style', label: 'Style transfers' },
  { id: 'adFormat', label: 'Ad-format' },
  { id: 'platform', label: 'Platform-optimized' },
];
