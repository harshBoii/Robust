import type { ImageGenState } from './types';

export function buildProductAdBasePrompt(state: ImageGenState, feedback?: string): string {
  const parts = [
    'Create a high-quality product advertisement image.',
    state.productDescription ? `Product: ${state.productDescription}` : null,
    state.brandTone ? `Brand tone: ${state.brandTone}` : null,
    state.aspectRatio ? `Aspect ratio preference: ${state.aspectRatio}` : null,
    'Keep the product recognizable and prominent. Professional lighting, clean composition, suitable for paid social ads.',
    feedback ? `User requested changes: ${feedback}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}

export function buildProductOnModelPrompt(
  state: ImageGenState,
  refs: { modelLabel: string; backgroundLabel: string; poseLabel: string },
  feedback?: string,
): string {
  const parts = [
    'Composite the product into a professional ecommerce photoshoot.',
    state.productDescription ? `Product: ${state.productDescription}` : null,
    `Model: ${refs.modelLabel}. Background: ${refs.backgroundLabel}. Pose: ${refs.poseLabel}.`,
    state.brandTone ? `Brand tone: ${state.brandTone}` : null,
    'Realistic lighting, natural shadows, product clearly visible and accurate.',
    feedback ? `User requested changes: ${feedback}` : null,
  ].filter(Boolean);
  return parts.join('\n');
}
