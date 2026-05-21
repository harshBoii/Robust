import 'server-only';

import OpenAI from 'openai';
import { toFile } from 'openai/uploads';

import { fetchImageBytesFromUrl } from '@/lib/cloudfare/r2-video-thumbnail';

import { IMAGE_GENERATION_MODEL } from './models';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type GenerateImageInput = {
  prompt: string;
  referenceImageUrl?: string | null;
  aspectRatio?: string | null;
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

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const size = resolveSize(input.aspectRatio);

  if (input.referenceImageUrl) {
    const bytes = await fetchImageBytesFromUrl(input.referenceImageUrl, {
      attempts: 3,
      delayMs: 1000,
    });
    if (!bytes) throw new Error('Could not load reference image for generation');

    const file = await toFile(Buffer.from(bytes), 'reference.png', { type: 'image/png' });

    const res = await openai.images.edit({
      model: IMAGE_GENERATION_MODEL,
      image: file,
      prompt: input.prompt,
      size,
      n: 1,
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image edit returned no data');
    return { imageBase64: b64, revisedPrompt: undefined };
  }

  const res = await openai.images.generate({
    model: IMAGE_GENERATION_MODEL,
    prompt: input.prompt,
    size,
    n: 1,
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image generate returned no data');
  return { imageBase64: b64, revisedPrompt: undefined };
}
