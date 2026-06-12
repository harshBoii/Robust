/** Branded image-generation personas (OpenAI or Fal backends). */

export type ImageQuality = 'low' | 'medium' | 'high';

export type ImageArtistId = 'adicasso' | 'crafta' | 'tintin' | 'adasta';

export type ImageArtistProvider = 'openai' | 'fal';

export type ImageArtistOption = {
  id: ImageArtistId;
  name: string;
  tagline: string;
  provider: ImageArtistProvider;
  openAiModel?: string;
  falTextToImageModel?: string;
  falEditModel?: string;
};

export const IMAGE_ARTISTS: ImageArtistOption[] = [
  {
    id: 'adicasso',
    name: 'Mr Adicasso',
    tagline: 'The best in the game',
    provider: 'openai',
    openAiModel: 'gpt-image-2',
  },
  {
    id: 'crafta',
    name: 'Mr Crafta',
    tagline: 'A good budget option',
    provider: 'openai',
    openAiModel: 'gpt-image-1.5',
  },
  {
    id: 'tintin',
    name: 'Tintin',
    tagline: 'Cheaper option',
    provider: 'openai',
    openAiModel: 'gpt-image-1',
  },
  {
    id: 'adasta',
    name: 'Mr Adasta',
    tagline: 'stylized transforms',
    provider: 'fal',
    falTextToImageModel: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    falEditModel: 'fal-ai/bytedance/seedream/v4.5/edit',
  },
];

export const IMAGE_QUALITY_OPTIONS: Array<{ id: ImageQuality; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export const DEFAULT_IMAGE_ARTIST_ID: ImageArtistId = 'adicasso';
export const DEFAULT_IMAGE_QUALITY: ImageQuality = 'low';

export function findImageArtist(id: string | undefined | null): ImageArtistOption {
  return (
    IMAGE_ARTISTS.find((a) => a.id === id) ??
    IMAGE_ARTISTS.find((a) => a.id === DEFAULT_IMAGE_ARTIST_ID)!
  );
}

export function resolveImageGenApiOptions(state: {
  imageArtistId?: string | null;
  imageQuality?: string | null;
}): { model: string; quality: ImageQuality; provider: ImageArtistProvider } {
  const artist = findImageArtist(state.imageArtistId);
  const q = state.imageQuality;
  const quality: ImageQuality =
    q === 'low' || q === 'medium' || q === 'high' ? q : DEFAULT_IMAGE_QUALITY;
  const model =
    artist.provider === 'fal'
      ? (artist.falTextToImageModel ?? artist.falEditModel ?? 'fal')
      : (artist.openAiModel ?? 'gpt-image-1');
  return { model, quality, provider: artist.provider };
}
