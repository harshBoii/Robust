import { buildVariationBlock } from '@/lib/image-gen/prompt-variations';

export function buildAutoStaticPrompt(input: {
  briefPrompt: string;
  brandDnaBlock: string | null;
  brandTone: string | null;
  artistStyle: string | null;
  aspectRatio: string;
  productRef?: { title: string; description: string | null } | null;
  hasLogo?: boolean;
  variationIndex?: number;
  variationCount?: number;
}): string {
  if (input.productRef) {
    const productLine = input.productRef.description?.trim()
      ? `${input.productRef.title}: ${input.productRef.description.trim()}`
      : input.productRef.title;

    const parts = [
      'Create a high-quality product advertisement image.',
      'Reference images are provided in this order: (1) product image.',
      input.hasLogo
        ? '(2) brand logo — incorporate it naturally in the composition (corner badge, watermark, or inline brand element).'
        : null,
      `Product: ${productLine}`,
      `Campaign brief: ${input.briefPrompt}`,
      input.brandTone ? `Brand tone: ${input.brandTone}` : null,
      input.brandDnaBlock ? `Brand DNA:\n${input.brandDnaBlock}` : null,
      `Aspect ratio: ${input.aspectRatio}`,
      input.artistStyle ? `Artist style: ${input.artistStyle}` : null,
      `\n--- Creative Direction ---\n${buildVariationBlock()}`,
      'Keep product recognizable. Apply the creative direction above strictly — do not default to a centered product on a white background.',
      'High quality Meta ad static, no watermark, commercial photography.',
      input.variationCount && input.variationCount > 1
        ? `Variation ${(input.variationIndex ?? 0) + 1} of ${input.variationCount}.`
        : null,
    ].filter(Boolean);

    return parts.join('\n\n');
  }

  const parts = [
    input.briefPrompt,
    input.brandDnaBlock ? `Brand DNA:\n${input.brandDnaBlock}` : null,
    input.artistStyle ? `Style: ${input.artistStyle}` : null,
    'High quality Meta ad static, no watermark, commercial photography.',
    input.variationCount && input.variationCount > 1
      ? `Variation ${(input.variationIndex ?? 0) + 1} of ${input.variationCount}.`
      : null,
  ].filter(Boolean);

  return parts.join('\n\n');
}
