import type { ImageArtistId } from './image-artists';

/** Concrete visual style strings injected into generation prompts per artist persona. */
export const ARTIST_STYLE_MAP: Record<ImageArtistId, string> = {
  adicasso:
    'cinematic photography style, anamorphic lens look, film grain, color graded, premium campaign aesthetic',
  crafta:
    'commercial studio product photography, clean lines, professional retouching, reliable e-commerce look',
  tintin:
    'bold graphic design, flat illustration accents, high contrast, solid color blocks, direct-response energy',
  adasta:
    'stylized Seedream aesthetic, bold transforms, expressive color grading, editorial ad composition with crisp typography',
};

export function getArtistStylePrompt(artistId: string | undefined | null): string | null {
  if (!artistId) return null;
  return ARTIST_STYLE_MAP[artistId as ImageArtistId] ?? null;
}
