import type { ImageGenState } from './types';

/** Minimal edit instruction when regenerating from a prior image (images.edit). */
export function buildImageEditPrompt(feedback: string): string {
  return `Do Not Change anything else , the changes i need are :${feedback.trim()}`;
}

export function buildProductAdBasePrompt(state: ImageGenState, feedback?: string): string {
  if (feedback?.trim()) {
    return buildImageEditPrompt(feedback);
  }

  const parts = [
    'Create a high-quality product advertisement image.',
    state.productDescription ? `Product: ${state.productDescription}` : null,
    state.brandTone ? `Brand tone: ${state.brandTone}` : null,
    state.aspectRatio ? `Aspect ratio preference: ${state.aspectRatio}` : null,
    'Keep the product recognizable and prominent. Professional lighting, clean composition, suitable for paid social ads.',
  ].filter(Boolean);
  return parts.join('\n');
}

export function buildProductOnModelPrompt(
  state: ImageGenState,
  refs: {
    modelLabel: string;
    backgroundLabel: string;
    poseLabel: string;
    modelSource?: string;
    backgroundSource?: string;
    poseSource?: string;
  },
  feedback?: string,
): string {
  if (feedback?.trim()) {
    return buildImageEditPrompt(feedback);
  }

  const parts = [
    'Create a professional ecommerce product-on-model photoshoot composite.',
    'You receive four reference images in order: (1) product hero, (2) model reference, (3) background scene, (4) pose reference.',
    'Place the product on the model using the pose and background. Keep the product accurate and clearly visible.',
    state.productDescription ? `Product description: ${state.productDescription}` : null,
    `Model (${refs.modelSource ?? 'reference'}): ${refs.modelLabel}.`,
    `Background (${refs.backgroundSource ?? 'reference'}): ${refs.backgroundLabel}.`,
    `Pose (${refs.poseSource ?? 'reference'}): ${refs.poseLabel}.`,
    state.brandTone ? `Brand tone: ${state.brandTone}` : null,
    state.aspectRatio ? `Aspect ratio preference: ${state.aspectRatio}` : null,
    'Match lighting and shadows across all elements. Photorealistic, ad-ready framing.',
  ].filter(Boolean);
  return parts.join('\n');
}
