import 'server-only';

import { handleUserFacingLlmError } from '@/lib/assistant/user-facing-llm-error';
import { getTemplateById } from '@/lib/templates/catalog';
import type { TemplateDefinition } from '@/lib/templates/types';

import { buildImageEditPrompt } from './base-prompts';
import { generateImage } from './generate-image';
import { resolveTemplateReferenceUrls as resolveTemplateRefs } from './resolve-asset-image-url';
import { resolveLastGeneratedImageUrl } from './resolve-last-generated-image';
import { storeGeneratedImage } from './store-generated';
import { appendGeneratedAsset } from './state';
import type { ImageGenState } from './types';

export async function resolveTemplateReferenceUrls(
  companyId: string,
  _def: TemplateDefinition,
  ig: ImageGenState,
): Promise<string[]> {
  return resolveTemplateRefs(companyId, ig);
}

async function generateOneWithRetry(input: {
  companyId: string;
  sessionId: string;
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio?: string | null;
  imageArtistId?: string | null;
  imageQuality?: ImageGenState['imageQuality'];
  label: string;
}): Promise<{
  label: string;
  assetId?: string;
  imageUrl?: string;
  status: 'done' | 'failed';
  error?: string;
}> {
  const run = async () => {
    const gen = await generateImage({
      prompt: input.prompt,
      referenceImageUrls: input.referenceImageUrls,
      aspectRatio: input.aspectRatio,
      imageArtistId: input.imageArtistId,
      quality: input.imageQuality,
    });
    const stored = await storeGeneratedImage({
      companyId: input.companyId,
      sessionId: input.sessionId,
      imageBase64: gen.imageBase64,
      title: input.label,
      label: input.label,
    });
    return {
      label: input.label,
      assetId: stored.assetId,
      imageUrl: stored.imageUrl,
      status: 'done' as const,
    };
  };

  try {
    return await run();
  } catch (firstErr) {
    try {
      return await run();
    } catch (secondErr) {
      return {
        label: input.label,
        status: 'failed' as const,
        error: handleUserFacingLlmError('image-gen/template-generate', secondErr),
      };
    }
  }
}

export const TEMPLATE_POST_RESULT_OPTIONS = [
  {
    id: 'regenerate',
    label: 'Regenerate',
    description: 'Adjust details and generate again',
  },
  {
    id: 'postToAds',
    label: 'Post to ads',
    description: 'Continue to Meta ad campaign setup',
  },
] as const;

export async function runTemplateGenerate(input: {
  companyId: string;
  sessionId: string;
  ig: ImageGenState;
}): Promise<{ ig: ImageGenState; succeeded: number; failed: number }> {
  const def = input.ig.templateId ? getTemplateById(input.ig.templateId) : undefined;
  if (!def) throw new Error('Template not found');

  let ig: ImageGenState = { ...input.ig, step: 'generateTemplate' };
  const aspectRatio = def.fixedAspectRatio ?? ig.aspectRatio ?? null;
  const editFeedback = ig.rejectFeedback?.trim();

  let prompt: string;
  let refUrls: string[];

  if (editFeedback) {
    const lastUrl = await resolveLastGeneratedImageUrl(input.companyId, ig);
    if (!lastUrl) throw new Error('No generated image to edit.');
    prompt = buildImageEditPrompt(editFeedback);
    refUrls = [lastUrl];
  } else {
    refUrls = await resolveTemplateReferenceUrls(input.companyId, def, ig);
    if (!refUrls.length) throw new Error('Required images are missing');
    prompt = def.buildGenerationPrompt(ig, 0);
  }

  const out = await generateOneWithRetry({
    companyId: input.companyId,
    sessionId: input.sessionId,
    prompt,
    referenceImageUrls: refUrls,
    aspectRatio,
    imageArtistId: ig.imageArtistId,
    imageQuality: ig.imageQuality,
    label: def.name,
  });

  ig.templateOutputs = [out];
  if (out.status === 'done' && out.assetId) {
    ig = appendGeneratedAsset(ig, {
      assetId: out.assetId,
      label: def.name,
      imageUrl: out.imageUrl,
    });
    ig.baseGeneratedAssetId = out.assetId;
    ig.baseGeneratedImageUrl = out.imageUrl;
  }
  ig.step = 'reviewTemplate';
  ig.rejectFeedback = undefined;
  return {
    ig,
    succeeded: out.status === 'done' ? 1 : 0,
    failed: out.status === 'failed' ? 1 : 0,
  };
}

export async function runTemplateRegenerateSlot(input: {
  companyId: string;
  sessionId: string;
  ig: ImageGenState;
  index: number;
}): Promise<ImageGenState> {
  const def = input.ig.templateId ? getTemplateById(input.ig.templateId) : undefined;
  if (!def) throw new Error('Template not found');

  const aspectRatio = def.fixedAspectRatio ?? input.ig.aspectRatio ?? null;
  const label = def.name;
  const editFeedback = input.ig.rejectFeedback?.trim();

  let prompt: string;
  let refUrls: string[];

  if (editFeedback) {
    const lastUrl = await resolveLastGeneratedImageUrl(input.companyId, input.ig);
    if (!lastUrl) throw new Error('No generated image to edit.');
    prompt = buildImageEditPrompt(editFeedback);
    refUrls = [lastUrl];
  } else {
    refUrls = await resolveTemplateReferenceUrls(input.companyId, def, input.ig);
    if (!refUrls.length) throw new Error('Required images are missing');
    prompt = def.buildGenerationPrompt(input.ig, input.index);
  }

  const out = await generateOneWithRetry({
    companyId: input.companyId,
    sessionId: input.sessionId,
    prompt,
    referenceImageUrls: refUrls,
    aspectRatio,
    imageArtistId: input.ig.imageArtistId,
    imageQuality: input.ig.imageQuality,
    label,
  });

  const outputs = [...(input.ig.templateOutputs ?? [])];
  outputs[input.index] = out;
  let ig: ImageGenState = { ...input.ig, templateOutputs: outputs };
  if (out.status === 'done' && out.assetId) {
    ig = appendGeneratedAsset(ig, {
      assetId: out.assetId,
      label,
      imageUrl: out.imageUrl,
    });
  }
  return ig;
}
