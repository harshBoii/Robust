/** Branded image-generation personas (maps to OpenAI image models). */

export type ImageQuality = 'low' | 'medium' | 'high';

export type ImageArtistId = 'adicasso' | 'crafta' | 'tintin';

export type ImageArtistOption = {
  id: ImageArtistId;
  name: string;
  tagline: string;
  openAiModel: string;
};

export const IMAGE_ARTISTS: ImageArtistOption[] = [
  {
    id: 'adicasso',
    name: 'Mr Adicasso',
    tagline: 'The best in the game',
    openAiModel: 'gpt-image-2',
  },
  {
    id: 'crafta',
    name: 'Mr Crafta',
    tagline: 'A good budget option',
    openAiModel: 'gpt-image-1.5',
  },
  {
    id: 'tintin',
    name: 'Tintin',
    tagline: 'Cheaper option',
    openAiModel: 'gpt-image-1',
  },
];

export const IMAGE_QUALITY_OPTIONS: Array<{ id: ImageQuality; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const DEFAULT_IMAGE_ARTIST_ID: ImageArtistId = 'crafta';
export const DEFAULT_IMAGE_QUALITY: ImageQuality = 'medium';

export function findImageArtist(id: string | undefined | null): ImageArtistOption {
  return IMAGE_ARTISTS.find((a) => a.id === id) ?? IMAGE_ARTISTS[1];
}

export function resolveImageGenApiOptions(state: {
  imageArtistId?: string | null;
  imageQuality?: string | null;
}): { model: string; quality: ImageQuality } {
  const artist = findImageArtist(state.imageArtistId);
  const q = state.imageQuality;
  const quality: ImageQuality =
    q === 'low' || q === 'medium' || q === 'high' ? q : DEFAULT_IMAGE_QUALITY;
  return { model: artist.openAiModel, quality };
}
