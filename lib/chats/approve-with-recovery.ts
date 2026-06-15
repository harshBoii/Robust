import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { createAndStoreCampaignFromPreset, createAndStoreAdSetFromPreset } from '@/lib/meta/sync';
import { prisma } from '@/lib/prisma';

import {
  isPixelMissingError,
  tryFixAdsetDraftForPixelError,
  tryFixAdsetDraftForOptimizationMismatch,
  tryFixCampaignDraftForError,
} from './preset-error-recovery';
import { alignAdsetPresetToCampaignSiblings, isOptimizationDeliveryMismatchError } from '@/lib/meta/campaign-adset-alignment';
import { runPresetChatTurnForMetaError } from './preset-chat-turn';
import type { WorkflowState } from './types';

function logAutoFix(
  phase: 'started' | 'retry' | 'deterministic' | 'pixel' | 'llm' | 'exhausted',
  target: 'campaign' | 'adset',
  companyId: string,
  attempt: number,
  detail?: string,
) {
  const msg = `[chats:auto-fix] ${phase} (${target}) attempt=${attempt} company=${companyId}`;
  if (detail) console.log(msg, detail.slice(0, 500));
  else console.log(msg);
}

export type ApproveCampaignResult =
  | {
      ok: true;
      draft: CampaignPreset;
      presetId: string;
      created: { id: string; name: string };
      recovered: boolean;
    }
  | { ok: false; draft: CampaignPreset; error: string; recovered: boolean; reply?: string };

export type ApproveAdsetResult =
  | {
      ok: true;
      draft: AdsetPreset;
      presetId: string;
      created: { id: string; name: string };
      recovered: boolean;
    }
  | { ok: false; draft: AdsetPreset; error: string; recovered: boolean; reply?: string };

function campaignPresetData(companyId: string, draft: CampaignPreset) {
  return {
    companyId,
    name: draft.name || 'Chat Campaign',
    objective: draft.objective,
    status: draft.status,
    spendCap: draft.spendCap ? BigInt(draft.spendCap) : null,
    dailyBudget: draft.dailyBudget ? BigInt(draft.dailyBudget) : null,
    lifetimeBudget: draft.lifetimeBudget ? BigInt(draft.lifetimeBudget) : null,
    bidStrategy: draft.bidStrategy,
    specialAdCategories: draft.specialAdCategories ?? [],
    isAdsetBudgetSharingEnabled: draft.isAdsetBudgetSharingEnabled,
  };
}

async function syncCampaignPresetAndCreateOnMeta(
  companyId: string,
  draft: CampaignPreset,
  presetId: string | undefined,
): Promise<{ presetId: string; created: { id: string; name: string } }> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!integration) throw new Error('Connect Meta in Manager → Meta Connection first.');

  const data = campaignPresetData(companyId, draft);
  const preset = presetId
    ? await prisma.campaignPreset.update({ where: { id: presetId }, data })
    : await prisma.campaignPreset.create({ data });

  const created = await createAndStoreCampaignFromPreset({
    metaIntegrationId: integration.id,
    presetId: preset.id,
  });

  return {
    presetId: preset.id,
    created: { id: created.id, name: created.name ?? preset.name ?? 'Campaign' },
  };
}

function adsetPresetData(companyId: string, campaignId: string, draft: AdsetPreset) {
  return {
    companyId,
    name: draft.name || 'Chat Ad Set',
    dailyBudget: draft.dailyBudget ? BigInt(draft.dailyBudget) : null,
    lifetimeBudget: draft.lifetimeBudget ? BigInt(draft.lifetimeBudget) : null,
    scheduleDuration: draft.scheduleDuration,
    scheduleCustomEnd: draft.scheduleCustomEnd ? new Date(draft.scheduleCustomEnd) : null,
    billingEvent: draft.billingEvent,
    optimizationGoal: draft.optimizationGoal,
    destinationType: draft.destinationType,
    bidStrategy: draft.bidStrategy,
    bidAmount: draft.bidAmount ? BigInt(draft.bidAmount) : null,
    pacingType: draft.pacingType,
    promotedObject: (draft.promotedObject ?? undefined) as object | undefined,
    attributionSpec: (draft.attributionSpec ?? undefined) as object | undefined,
    targeting: (draft.targeting ?? undefined) as object | undefined,
    bidConstraints: (draft.bidConstraints ?? undefined) as object | undefined,
    pinnedCampaignId: campaignId,
  };
}

async function syncAdsetPresetAndCreateOnMeta(
  companyId: string,
  campaignId: string,
  draft: AdsetPreset,
  presetId: string | undefined,
): Promise<{ presetId: string; created: { id: string; name: string } }> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!integration) throw new Error('Connect Meta first.');

  const data = adsetPresetData(companyId, campaignId, draft);
  const preset = presetId
    ? await prisma.adsetPreset.update({ where: { id: presetId }, data })
    : await prisma.adsetPreset.create({ data });

  const created = await createAndStoreAdSetFromPreset({
    metaIntegrationId: integration.id,
    campaignDbId: campaignId,
    presetId: preset.id,
  });

  return {
    presetId: preset.id,
    created: { id: created.id, name: created.name ?? preset.name ?? 'Ad set' },
  };
}

export async function approveCampaignWithRecovery(
  companyId: string,
  draft: CampaignPreset,
  state: WorkflowState,
): Promise<ApproveCampaignResult> {
  let current = draft;
  let recovered = false;
  let lastError = '';
  let presetId: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await syncCampaignPresetAndCreateOnMeta(companyId, current, presetId);
      presetId = result.presetId;
      return { ok: true, draft: current, presetId, created: result.created, recovered };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logAutoFix(attempt === 0 ? 'started' : 'retry', 'campaign', companyId, attempt + 1, lastError);

      const deterministic = tryFixCampaignDraftForError(current, lastError);
      if (deterministic) {
        logAutoFix('deterministic', 'campaign', companyId, attempt + 1);
        current = deterministic;
        recovered = true;
        continue;
      }

      logAutoFix('llm', 'campaign', companyId, attempt + 1, lastError);
      console.log('[chats:auto-fix] Campaign recovery draft', { campaignDraft: current });
      const llm = await runPresetChatTurnForMetaError({
        target: 'campaign',
        errorMessage: lastError,
        state: { ...state, draftCampaign: current },
      });
      if (llm?.draftCampaign) {
        current = llm.draftCampaign;
        recovered = true;
        continue;
      }
      logAutoFix('exhausted', 'campaign', companyId, attempt + 1, lastError);
      break;
    }
  }

  return {
    ok: false,
    draft: current,
    error: lastError,
    recovered,
    reply: recovered
      ? 'I adjusted the campaign preset but Meta still rejected it. Review the preview and try again, or tell me what to change.'
      : 'I could not create the campaign on Meta yet. Open **Error details** below, then tell me how you want to fix it.',
  };
}

export async function approveAdsetWithRecovery(
  companyId: string,
  campaignId: string,
  draft: AdsetPreset,
  state: WorkflowState,
  campaignObjective: string | null | undefined,
): Promise<ApproveAdsetResult> {
  let current = draft;
  const preAligned = await alignAdsetPresetToCampaignSiblings(campaignId, current);
  if (preAligned.convention) {
    current = preAligned.draft;
  }
  let recovered = preAligned.convention != null;
  let lastError = '';
  let presetId: string | undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await syncAdsetPresetAndCreateOnMeta(
        companyId,
        campaignId,
        current,
        presetId,
      );
      presetId = result.presetId;
      return { ok: true, draft: current, presetId, created: result.created, recovered };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logAutoFix(attempt === 0 ? 'started' : 'retry', 'adset', companyId, attempt + 1, lastError);

      if (isPixelMissingError(lastError)) {
        logAutoFix('pixel', 'adset', companyId, attempt + 1, lastError);
        const fixed = await tryFixAdsetDraftForPixelError(current, campaignObjective, companyId);
        if (fixed) {
          logAutoFix('deterministic', 'adset', companyId, attempt + 1, 'pixel/conversion tracking');
          current = fixed;
          recovered = true;
          continue;
        }
      }

      if (isOptimizationDeliveryMismatchError(lastError)) {
        logAutoFix('deterministic', 'adset', companyId, attempt + 1, 'optimization delivery match');
        const fixed = await tryFixAdsetDraftForOptimizationMismatch(current, campaignId);
        if (fixed) {
          current = fixed;
          recovered = true;
          continue;
        }
      }

      const deterministic = tryFixCampaignDraftForError(
        state.draftCampaign as CampaignPreset,
        lastError,
      );
      if (deterministic) {
        // campaign field fix unlikely for adset create — skip
      }

      logAutoFix('llm', 'adset', companyId, attempt + 1, lastError);
      console.log('[chats:auto-fix] Adset recovery state', {
        campaignId,
        campaignObjective,
        campaignDraft: state.draftCampaign,
        adsetDraft: current,
      });
      const llm = await runPresetChatTurnForMetaError({
        target: 'adset',
        errorMessage: lastError,
        state: { ...state, draftAdset: current },
      });
      if (llm?.draftAdset) {
        current = llm.draftAdset;
        recovered = true;
        continue;
      }
      logAutoFix('exhausted', 'adset', companyId, attempt + 1, lastError);
      break;
    }
  }

  return {
    ok: false,
    draft: current,
    error: lastError,
    recovered,
    reply: recovered
      ? 'I updated the ad set preset (conversion tracking / pixel settings) but Meta still rejected it. Review and approve again.'
      : 'I could not create the ad set on Meta yet. Open **Error details** below, then tell me how to fix it.',
  };
}
