import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { PRESET_BUILD_MODEL } from '@/lib/assistant/models';
import {
  buildPresetChatMessagesForApi,
  buildPresetChatSystemPrompt,
  resolvePresetChatAdType,
  resolvePresetChatTone,
} from '@/lib/assistant/preset-chat-prompt';
import { mergeAdsetPresetPatch, mergeCampaignPresetPatch } from '@/lib/assistant/merge-preset-patch';
import { presetChatResponseSchema } from '@/lib/assistant/schemas';
import { validateFullOrPartial } from '@/lib/assistant/validate-with-retry';

import { defaultAdsetDraft, defaultCampaignDraft } from './preset-drafts';
import type { WorkflowState } from './types';

export type PresetChatTurnResult = {
  draftCampaign: CampaignPreset;
  draftAdset: AdsetPreset;
  reply: string;
  presetChatMessages: { role: 'user' | 'assistant'; content: string }[];
};

export async function runPresetChatTurn(input: {
  target: 'campaign' | 'adset';
  userText: string;
  state: WorkflowState;
  priorMessages?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<PresetChatTurnResult> {
  const draftCampaign =
    (input.state.draftCampaign as CampaignPreset | undefined) ?? defaultCampaignDraft();
  const draftAdset = (input.state.draftAdset as AdsetPreset | undefined) ?? defaultAdsetDraft();

  const messages = [
    ...(input.priorMessages ?? input.state.presetChatMessages ?? []),
    { role: 'user' as const, content: input.userText },
  ];

  const adType = resolvePresetChatAdType(input.state.adType ?? null, draftCampaign);
  const tone = resolvePresetChatTone(input.state.tone ?? null);

  const system = buildPresetChatSystemPrompt(input.target);
  const apiMessages = buildPresetChatMessagesForApi({
    messages,
    presetTarget: input.target,
    adType,
    tone,
    currentCampaignDraft: draftCampaign,
    currentAdsetDraft: draftAdset,
    hasPixel: input.state.hasPixel,
    pixelId: input.state.pixelId,
  });

  const content = await completeJsonChatWithHistory({
    model: PRESET_BUILD_MODEL,
    system,
    messages: apiMessages,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  const result = validateFullOrPartial(parsed, presetChatResponseSchema, 1);
  const d = result.data;

  let nextCampaign = draftCampaign;
  let nextAdset = draftAdset;

  if (d && typeof d === 'object') {
    const patch = d as {
      campaign?: Partial<import('@/lib/assistant/schemas').CampaignPresetPatch>;
      adset?: Partial<import('@/lib/assistant/schemas').AdsetPresetPatch>;
    };
    if (input.target === 'campaign' && patch.campaign) {
      nextCampaign = mergeCampaignPresetPatch(draftCampaign, patch.campaign);
    }
    if (input.target === 'adset' && patch.adset) {
      nextAdset = mergeAdsetPresetPatch(draftAdset, patch.adset);
    }
  }

  const replyText =
    d && typeof d === 'object' && 'reply' in d && typeof (d as { reply?: string }).reply === 'string'
      ? (d as { reply: string }).reply
      : 'Updated your preset draft.';

  return {
    draftCampaign: nextCampaign,
    draftAdset: nextAdset,
    reply: replyText,
    presetChatMessages: [
      ...messages,
      { role: 'assistant', content: replyText },
    ],
  };
}

export async function runPresetChatTurnForMetaError(input: {
  target: 'campaign' | 'adset';
  errorMessage: string;
  state: WorkflowState;
}): Promise<PresetChatTurnResult | null> {
  const draftCampaign =
    (input.state.draftCampaign as CampaignPreset | undefined) ?? defaultCampaignDraft();
  const draftAdset =
    (input.state.draftAdset as AdsetPreset | undefined) ?? defaultAdsetDraft();
  const adType = resolvePresetChatAdType(input.state.adType ?? null, draftCampaign);
  const tone = resolvePresetChatTone(input.state.tone ?? null);

  const contextMessages = buildPresetChatMessagesForApi({
    messages: [{ role: 'user', content: '(meta error recovery)' }],
    presetTarget: input.target,
    adType,
    tone,
    currentCampaignDraft: draftCampaign,
    currentAdsetDraft: draftAdset,
    hasPixel: input.state.hasPixel,
    pixelId: input.state.pixelId,
  });
  const contextBlock =
    contextMessages.find((m) => m.role === 'user')?.content ?? '(no context block)';

  console.log(
    `[chats:auto-fix] LLM preset repair (${input.target})`,
    input.errorMessage.slice(0, 300),
  );
  console.log('[chats:auto-fix] Campaign context fed', {
    target: input.target,
    adType,
    tone,
    campaignId: input.state.campaignId ?? null,
    campaign: draftCampaign,
    ...(input.target === 'adset' ? { adset: draftAdset } : {}),
  });
  console.log('[chats:auto-fix] LLM context block\n', contextBlock);

  const userText = `Meta API / validation error while creating the ${input.target === 'campaign' ? 'campaign' : 'ad set'}:\n\n${input.errorMessage}\n\nFix the preset so creation succeeds. Do not change targeting_automation or Advantage audience to work around this — fix the actual field mentioned in the error.`;
  try {
    return await runPresetChatTurn({
      target: input.target,
      userText,
      state: input.state,
    });
  } catch (err) {
    console.error('[preset-chat-turn] recovery LLM failed:', err);
    return null;
  }
}
