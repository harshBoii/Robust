import 'server-only';

import { z } from 'zod';

import { completeJsonChat } from '@/lib/assistant/openai-json';
import { CLASSIFIER_MODEL } from '@/lib/image-gen/models';
import type { ImageGenState, ImageGenStep } from '@/lib/image-gen/types';
import { prisma } from '@/lib/prisma';

import {
  getBackStepOptions,
  isAllowedBackStep,
  type BackStepOption,
} from './workflow-navigation';
import type { ChatWorkflowStep, WorkflowState } from './types';

export type EmptyPickerKind = 'adset' | 'campaign' | 'gallery' | 'shopifyProducts';

export type EmptyPickerAlternative =
  | 'create_new_adset'
  | 'create_new_campaign'
  | 'upload_creatives'
  | 'gallery_pick'
  | 'custom_upload';

const decisionSchema = z.object({
  intent: z.enum(['go_back', 'use_alternative', 'stay']),
  targetStep: z.string().optional(),
  alternative: z
    .enum([
      'create_new_adset',
      'create_new_campaign',
      'upload_creatives',
      'gallery_pick',
      'custom_upload',
    ])
    .optional(),
});

export type EmptyPickerDecision = z.infer<typeof decisionSchema>;

export async function isAdsetPickerEmpty(
  companyId: string,
  campaignDbId: string | undefined,
): Promise<boolean> {
  if (!campaignDbId) return true;
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!integration) return true;
  const campaign = await prisma.metaCampaign.findFirst({
    where: { id: campaignDbId, metaIntegrationId: integration.id },
    select: { id: true },
  });
  if (!campaign) return true;
  const count = await prisma.metaAdSet.count({
    where: { campaignId: campaign.id, metaIntegrationId: integration.id },
  });
  return count === 0;
}

export async function isCampaignPickerEmpty(companyId: string): Promise<boolean> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!integration) return true;
  const count = await prisma.metaCampaign.count({
    where: { metaIntegrationId: integration.id },
  });
  return count === 0;
}

export async function isGalleryPickerEmpty(companyId: string): Promise<boolean> {
  const count = await prisma.bulkUpload.count({
    where: {
      companyId,
      assets: { some: {} },
    },
  });
  return count === 0;
}

export async function isShopifyProductPickerEmpty(companyId: string): Promise<boolean> {
  const count = await prisma.shopifyProduct.count({
    where: { companyId, featuredImageUrl: { not: null } },
  });
  return count === 0;
}

export function detectAdsEmptyPicker(
  step: ChatWorkflowStep,
  state: WorkflowState,
): EmptyPickerKind | null {
  if (step === 'adsetSelect') return 'adset';
  if (step === 'campaignSelect') return 'campaign';
  if (step === 'mediaPick') return 'gallery';
  return null;
}

export function detectImageGenEmptyPicker(ig: ImageGenState): EmptyPickerKind | null {
  if (ig.step === 'shopifyPick') return 'shopifyProducts';
  return null;
}

function pickerContextLine(kind: EmptyPickerKind): string {
  switch (kind) {
    case 'adset':
      return 'The user chose an existing ad set, but this campaign has no ad sets in the account yet.';
    case 'campaign':
      return 'The user chose an existing campaign, but no Meta campaigns are available to pick.';
    case 'gallery':
      return 'The user chose to pick creatives from the gallery, but no gallery folders with assets exist.';
    case 'shopifyProducts':
      return 'The user chose Shopify as product source, but no synced Shopify products are available.';
  }
}

function allowedAlternatives(kind: EmptyPickerKind): EmptyPickerAlternative[] {
  switch (kind) {
    case 'adset':
      return ['create_new_adset'];
    case 'campaign':
      return ['create_new_campaign'];
    case 'gallery':
      return ['upload_creatives', 'gallery_pick'];
    case 'shopifyProducts':
      return ['custom_upload'];
  }
}

function imageGenBackOptions(ig: ImageGenState): Array<{ resetStep: ImageGenStep; label: string }> {
  if (ig.subpath === 'productOnModel') {
    return [{ resetStep: 'productSource', label: 'Product source' }];
  }
  if (ig.subpath === 'productAd') {
    return [{ resetStep: 'imageSource', label: 'Image source' }];
  }
  return [{ resetStep: 'variantImageSource', label: 'Variant image source' }];
}

export async function classifyEmptyPickerIntent(input: {
  userText: string;
  kind: EmptyPickerKind;
  backOptions: BackStepOption[];
  alternatives: EmptyPickerAlternative[];
}): Promise<EmptyPickerDecision> {
  const backList =
    input.backOptions.length > 0
      ? input.backOptions.map((o) => `- ${o.step}: ${o.label}`).join('\n')
      : '(none)';
  const altList = input.alternatives.map((a) => `- ${a}`).join('\n');

  const system = `You interpret the user's message when a picker UI has ZERO options available.

Context: ${pickerContextLine(input.kind)}

If the user wants to return to a previous step (go back, wrong choice, change campaign, try another way, start over, etc.), set intent to "go_back" and set targetStep to exactly one of these workflow steps:
${backList}

If they want the suggested alternate path instead of "existing" (e.g. create new ad set, upload instead of gallery, custom upload instead of Shopify), set intent to "use_alternative" and pick one alternative:
${altList}

If they are not asking to go back or switch path (questions, frustration without direction, etc.), set intent to "stay".

Respond JSON only: { "intent": "go_back" | "use_alternative" | "stay", "targetStep"?: string, "alternative"?: string }`;

  const raw = await completeJsonChat({
    model: CLASSIFIER_MODEL,
    system,
    user: input.userText,
  });

  try {
    const parsed = decisionSchema.parse(JSON.parse(raw));
    if (parsed.intent === 'go_back' && parsed.targetStep) {
      const ok = input.backOptions.some((o) => o.step === parsed.targetStep);
      if (!ok) delete parsed.targetStep;
    }
    if (parsed.intent === 'use_alternative' && parsed.alternative) {
      if (!input.alternatives.includes(parsed.alternative)) delete parsed.alternative;
    }
    return parsed;
  } catch {
    return fallbackEmptyPickerDecision(input.userText, input.backOptions, input.alternatives);
  }
}

function fallbackEmptyPickerDecision(
  text: string,
  backOptions: BackStepOption[],
  alternatives: EmptyPickerAlternative[],
): EmptyPickerDecision {
  const lower = text.toLowerCase();
  if (
    /go back|previous step|wrong|change campaign|different campaign|start over|back to|not this|try again elsewhere/.test(
      lower,
    )
  ) {
    const hit =
      backOptions.find((o) => lower.includes(o.label.toLowerCase())) ??
      backOptions.find((o) => lower.includes(o.step.toLowerCase())) ??
      backOptions[0];
    if (hit) return { intent: 'go_back', targetStep: hit.step };
  }
  if (/create new|new ad set|from preset|upload|custom/.test(lower)) {
    const alt = alternatives[0];
    if (alt) return { intent: 'use_alternative', alternative: alt };
  }
  return { intent: 'stay' };
}

export async function resolveAdsEmptyPicker(
  companyId: string,
  step: ChatWorkflowStep,
  state: WorkflowState,
): Promise<{ kind: EmptyPickerKind; empty: boolean } | null> {
  const kind = detectAdsEmptyPicker(step, state);
  if (!kind) return null;

  let empty = false;
  if (kind === 'adset') empty = await isAdsetPickerEmpty(companyId, state.campaignId);
  else if (kind === 'campaign') empty = await isCampaignPickerEmpty(companyId);
  else if (kind === 'gallery') empty = await isGalleryPickerEmpty(companyId);

  return { kind, empty };
}

export function pickImageGenBackStep(
  ig: ImageGenState,
  userText: string,
): ImageGenStep | null {
  const opts = imageGenBackOptions(ig);
  const lower = userText.toLowerCase();
  const hit = opts.find((o) => lower.includes(o.label.toLowerCase()));
  return hit?.resetStep ?? opts[0]?.resetStep ?? null;
}
