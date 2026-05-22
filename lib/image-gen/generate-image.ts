import 'server-only';

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

import { fetchImageBytesFromUrl } from '@/lib/cloudfare/r2-video-thumbnail';

import { normalizeReferenceImageForOpenAI } from './normalize-reference-image';
import { loadCatalogImageBytes } from './read-catalog-image';

import {
  DEFAULT_IMAGE_ARTIST_ID,
  DEFAULT_IMAGE_QUALITY,
  findImageArtist,
  type ImageQuality,
} from './image-artists';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type GenerateImageInput = {
  prompt: string;
  referenceImageUrl?: string | null;
  /** Multiple references (e.g. product + model + background + pose). Takes precedence over referenceImageUrl. */
  referenceImageUrls?: string[] | null;
  aspectRatio?: string | null;
  model?: string | null;
  quality?: ImageQuality | null;
  imageArtistId?: string | null;
};

export type GenerateImageResult = {
  imageBase64: string;
  revisedPrompt?: string;
};

function resolveSize(aspectRatio?: string | null): '1024x1024' | '1536x1024' | '1024x1536' {
  if (aspectRatio === '16:9' || aspectRatio === 'landscape') return '1536x1024';
  if (aspectRatio === '9:16' || aspectRatio === 'portrait') return '1024x1536';
  return '1024x1024';
}

function resolveModel(input: GenerateImageInput): string {
  if (input.model?.trim()) return input.model.trim();
  return findImageArtist(input.imageArtistId ?? DEFAULT_IMAGE_ARTIST_ID).openAiModel;
}

function resolveQuality(input: GenerateImageInput): ImageQuality {
  const q = input.quality;
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return DEFAULT_IMAGE_QUALITY;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const size = resolveSize(input.aspectRatio);
  const model = resolveModel(input);
  const quality = resolveQuality(input);

  const commonParams = {
    model,
    prompt: input.prompt,
    size,
    n: 1 as const,
    quality,
  };

  const refUrls =
    input.referenceImageUrls?.filter((u) => typeof u === 'string' && u.trim()) ??
    (input.referenceImageUrl ? [input.referenceImageUrl] : []);

  if (refUrls.length > 0) {
    const files = await Promise.all(
      refUrls.map(async (url, i) => {
        const bytes = url.startsWith('/image-gen/')
          ? await loadCatalogImageBytes(url)
          : await fetchImageBytesFromUrl(url, { attempts: 3, delayMs: 1000 });
        if (!bytes) throw new Error('Could not load reference image for generation');
        const normalized = await normalizeReferenceImageForOpenAI(bytes);
        return toFile(normalized.buffer, normalized.filename, { type: normalized.mimeType });
      }),
    );

    const res = await openai.images.edit({
      ...commonParams,
      image: files.length === 1 ? files[0]! : files,
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image edit returned no data');
    return { imageBase64: b64, revisedPrompt: undefined };
  }

  const res = await openai.images.generate({
    ...commonParams,
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image generate returned no data');
  return { imageBase64: b64, revisedPrompt: undefined };
}
