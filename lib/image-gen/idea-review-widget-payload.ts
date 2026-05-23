import type { ImageGenVariant } from './types';

export type IdeaReviewVariantPayload = {
  ideaLabel: string;
  prompt: string;
};

export function buildIdeaReviewWidgetPayload(
  variants: ImageGenVariant[],
): { variants: IdeaReviewVariantPayload[]; ideas: string[] } {
  return {
    variants: variants.map((v) => ({
      ideaLabel: v.ideaLabel,
      prompt: v.prompt,
    })),
    ideas: variants.map((v) => v.ideaLabel),
  };
}
