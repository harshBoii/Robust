import 'server-only';

import { type visualDnaUpsertSchema } from '@/lib/brand-dna/schemas';
import type { z } from 'zod';

import type { VisionVisualAnalysis } from './analyze-visual-screenshot';
import type { derivePaletteFromDom } from './normalize-colors';

type DomPalette = ReturnType<typeof derivePaletteFromDom>;

export function mergeVisualDna(
  dom: DomPalette,
  vision: VisionVisualAnalysis,
): z.infer<typeof visualDnaUpsertSchema> {
  return {
    visualStyle: vision.visual_style ?? null,
    visualMaturity: vision.visual_maturity ?? null,
    designComplexity: vision.design_complexity ?? null,
    primaryColor: dom.primaryColor,
    secondaryColor: dom.secondaryColor,
    accentColor: dom.accentColor,
    backgroundColor: dom.backgroundColor,
    headingFont: dom.headingFont,
    bodyFont: dom.bodyFont,
    typographyPersonality: vision.typography_personality ?? null,
    whitespaceLevel: dom.whitespaceLevel,
    contentDensity: dom.contentDensity,
    alignmentStyle: dom.alignmentStyle,
    cornerRadiusStyle: dom.cornerRadiusStyle,
    shadowStyle: dom.shadowStyle,
    preferredVisualMotif: vision.preferred_visual_motif ?? null,
    visualEmotion: vision.visual_emotion ?? null,
  };
}
