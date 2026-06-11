import { getArtistStylePrompt } from './artist-styles';
import { buildVariationBlock } from './prompt-variations';
import type { ImageGenState } from './types';

/** Minimal edit instruction when regenerating from a prior image (images.edit). */
export function buildImageEditPrompt(feedback: string): string {
  return `Do Not Change anything else , the changes i need are :${feedback.trim()}`;
}

function appendBrandDnaBlock(state: ImageGenState, parts: string[]): string[] {
  if (state.brandDnaPromptBlock?.trim()) {
    parts.push(state.brandDnaPromptBlock.trim());
  }
  return parts;
}

export function buildProductAdBasePrompt(state: ImageGenState, feedback?: string): string {
  if (feedback?.trim()) {
    return buildImageEditPrompt(feedback);
  }

  const variation = buildVariationBlock();
  const artistStyle = getArtistStylePrompt(state.imageArtistId);

  const parts = appendBrandDnaBlock(state, [
    'Create a high-quality product advertisement image.',
    state.productDescription ? `Product: ${state.productDescription}` : null,
    state.brandTone ? `Brand tone: ${state.brandTone}` : null,
    state.aspectRatio ? `Aspect ratio: ${state.aspectRatio}` : null,
    artistStyle ? `Artist style: ${artistStyle}` : null,
    `\n--- Creative Direction ---\n${variation}`,
    state.rivalIntelligenceBrief
      ? `Rival intelligence (use hooks and patterns, do not copy):\n${state.rivalIntelligenceBrief}`
      : null,
    'Keep product recognizable. Apply the creative direction above strictly — do not default to a centered product on a white background.',
  ].filter(Boolean) as string[]);
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

  const parts = appendBrandDnaBlock(state, [
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
  ].filter(Boolean) as string[]);
  return parts.join('\n');
}
