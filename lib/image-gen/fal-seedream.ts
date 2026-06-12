import 'server-only';

import { fetchImageBytesFromUrl } from '@/lib/cloudfare/r2-video-thumbnail';
import { getAppOrigin } from '@/lib/app-origin';

import { resolveCatalogImageUrl } from './catalog';
import type { ImageArtistOption, ImageQuality } from './image-artists';

const FAL_RUN_BASE = 'https://fal.run';

type FalImageSize = { width: number; height: number } | 'auto_2K';

type FalImageResponse = {
  images?: Array<{ url?: string }>;
};

function requireFalKey(): string {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error('FAL_KEY is not configured');
  return key;
}

function resolveFalAccessibleUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/image-gen/')) {
    return resolveCatalogImageUrl(trimmed, getAppOrigin());
  }
  if (trimmed.startsWith('/')) {
    return `${getAppOrigin()}${trimmed}`;
  }
  return trimmed;
}

function resolveFalImageSize(
  aspectRatio?: string | null,
  quality?: ImageQuality | null,
): FalImageSize {
  if (aspectRatio === '16:9' || aspectRatio === 'landscape') {
    return { width: 3072, height: 2048 };
  }
  if (aspectRatio === '9:16' || aspectRatio === 'portrait') {
    return { width: 2048, height: 3072 };
  }
  if (quality === 'high') return { width: 3072, height: 3072 };
  if (quality === 'medium') return 'auto_2K';
  return { width: 2048, height: 2048 };
}

async function callFalModel(modelId: string, input: Record<string, unknown>): Promise<FalImageResponse> {
  const res = await fetch(`${FAL_RUN_BASE}/${modelId}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${requireFalKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Fal image generation failed (${res.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
  }

  return (await res.json()) as FalImageResponse;
}

function buildFalEditPrompt(prompt: string, refCount: number): string {
  if (refCount <= 1) return prompt;
  const figureHint =
    refCount === 2
      ? 'Reference images: Figure 1 is the primary product image; Figure 2 is the brand logo. Use them as directed below.'
      : `Reference images are numbered Figure 1 through Figure ${refCount}. Preserve product identity from Figure 1.`;
  return `${figureHint}\n\n${prompt}`;
}

async function downloadImageAsBase64(url: string): Promise<string> {
  const bytes = await fetchImageBytesFromUrl(url, { attempts: 3, delayMs: 1000 });
  if (!bytes?.length) throw new Error('Could not download generated image from Fal');
  return Buffer.from(bytes).toString('base64');
}

export async function generateFalSeedreamImage(input: {
  artist: ImageArtistOption;
  prompt: string;
  referenceImageUrls?: string[] | null;
  aspectRatio?: string | null;
  quality?: ImageQuality | null;
}): Promise<{ imageBase64: string }> {
  const imageSize = resolveFalImageSize(input.aspectRatio, input.quality);
  const refUrls = (input.referenceImageUrls ?? []).filter((u) => u?.trim()).map(resolveFalAccessibleUrl);

  const modelId =
    refUrls.length > 0
      ? (input.artist.falEditModel ?? input.artist.falTextToImageModel)
      : input.artist.falTextToImageModel;

  if (!modelId) throw new Error('Fal model is not configured for this artist');

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    image_size: imageSize,
    num_images: 1,
    enable_safety_checker: true,
  };

  if (refUrls.length > 0) {
    payload.image_urls = refUrls;
    payload.prompt = buildFalEditPrompt(input.prompt, refUrls.length);
  }

  const result = await callFalModel(modelId, payload);
  const imageUrl = result.images?.[0]?.url;
  if (!imageUrl) throw new Error('Fal returned no image URL');

  const imageBase64 = await downloadImageAsBase64(imageUrl);
  return { imageBase64 };
}
