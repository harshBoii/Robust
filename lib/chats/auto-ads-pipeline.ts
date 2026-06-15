import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import type { GroupModel } from '@/app/components/createAd/types';
import { creativeSuggestForAsset } from '@/lib/assistant/creative-suggest-for-asset';
import {
  approveAdsetWithRecovery,
  approveCampaignWithRecovery,
} from '@/lib/chats/approve-with-recovery';
import {
  buildAdsetDraftFromCampaign,
  defaultCampaignDraft,
} from '@/lib/chats/preset-drafts';
import { runPresetChatTurn } from '@/lib/chats/preset-chat-turn';
import { appendChatMessages, getChatSession, updateChatSession } from '@/lib/chats/repository';
import { serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';
import { getAdAccountPixels } from '@/lib/meta/client';
import {
  enqueueBulkPublish,
  enqueueDraftJobs,
  runPublishWorkerForCompany,
} from '@/lib/meta/process-publish-jobs';
import { storeAdCreativeForAsset } from '@/lib/meta/store-ad-creative';
import {
  alignAdsetPresetToCampaignSiblings,
  formatConventionForLlm,
  getCampaignAdSetConvention,
} from '@/lib/meta/campaign-adset-alignment';
import { normalizeObjective } from '@/lib/meta/normalize-objective';
import { syncAdSets, syncCampaigns } from '@/lib/meta/sync';
import { checkAutoPermission } from '@/lib/meta-ads-auto/permissions';
import type { MetaAdsAutoConfigData } from '@/lib/meta-ads-auto/config';
import { prisma } from '@/lib/prisma';

import {
  decideCampaignAdset,
  validateCampaignAdsetDecision,
  type CampaignAdsetDecision,
} from './auto-ads/decide-campaign-adset';
import { generateAutoAdsStatics, newAutoPipelineRunId } from './auto-ads/generate-statics';

export type AutoAdsPipelineInput = {
  sessionId: string;
  companyId: string;
  userText: string;
  state: WorkflowState;
  config: MetaAdsAutoConfigData;
  userMessageRow?: SerializedMessage;
};

async function assistantProgress(
  sessionId: string,
  content: string,
): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [
    { role: 'ASSISTANT', content },
  ]);
  return serializeMessage(row);
}

function packageResult(
  session: Awaited<ReturnType<typeof getChatSession>>,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  if (!session) throw new Error('Session not found');
  const serialized = serializeSession(session);
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: serialized.currentStep,
      workflowState: serialized.workflowState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
  };
}

async function resolvePixel(companyId: string): Promise<{ hasPixel: boolean; pixelId: string | null }> {
  const integration = await prisma.metaIntegration.findUnique({
    where: { companyId },
    select: { adAccountId: true },
  });
  if (!integration?.adAccountId) return { hasPixel: false, pixelId: null };

  try {
    const pixels = await getAdAccountPixels(integration.adAccountId, { companyId });
    const available = pixels.filter((p) => p.is_unavailable !== true && p.id);
    if (!available.length) return { hasPixel: false, pixelId: null };
    return { hasPixel: true, pixelId: available[0]!.id ?? null };
  } catch {
    return { hasPixel: false, pixelId: null };
  }
}

async function applyCampaignDecision(
  companyId: string,
  state: WorkflowState,
  decision: CampaignAdsetDecision,
  userText: string,
  config: MetaAdsAutoConfigData,
): Promise<{ state: WorkflowState; campaignDbId: string }> {
  let next = { ...state };

  if (decision.campaignAction === 'use_existing' && decision.campaignId) {
    next.campaignId = decision.campaignId;
    const row = await prisma.metaCampaign.findUnique({
      where: { id: decision.campaignId },
      select: { objective: true },
    });
    if (row?.objective) {
      const normalizedObj = normalizeObjective(row.objective);
      next.adType = normalizedObj;
      // Silently update the DB record if it still carries a legacy objective
      if (normalizedObj !== row.objective) {
        await prisma.metaCampaign.update({
          where: { id: decision.campaignId },
          data: { objective: normalizedObj },
        });
      }
    }
    return { state: next, campaignDbId: decision.campaignId };
  }

  const perm = checkAutoPermission(config, 'new_campaign');
  if (!perm.allowed) throw new Error(perm.reason);

  const pixel = await resolvePixel(companyId);
  next.hasPixel = pixel.hasPixel;
  next.pixelId = pixel.pixelId;

  const objective = normalizeObjective(decision.objective ?? config.defaultObjective ?? 'OUTCOME_TRAFFIC');
  next.draftCampaign = defaultCampaignDraft(objective);
  next.adType = objective;
  next.presetTarget = 'campaign';

  const presetTurn = await runPresetChatTurn({
    target: 'campaign',
    userText,
    state: next,
  });
  next.draftCampaign = presetTurn.draftCampaign;
  next.draftAdset = presetTurn.draftAdset;

  const approved = await approveCampaignWithRecovery(
    companyId,
    presetTurn.draftCampaign,
    next,
  );
  if (!approved.ok) throw new Error(approved.error);

  next.draftCampaign = approved.draft;
  next.campaignId = approved.created.id;
  next.campaignPresetId = approved.presetId;
  return { state: next, campaignDbId: approved.created.id };
}

async function applyAdsetDecision(
  companyId: string,
  state: WorkflowState,
  decision: CampaignAdsetDecision,
  userText: string,
  campaignDbId: string,
  config: MetaAdsAutoConfigData,
): Promise<{ state: WorkflowState; adSetDbId: string }> {
  let next = { ...state };

  if (decision.adsetAction === 'use_existing' && decision.adsetId) {
    next.defaultAdSetId = decision.adsetId;
    return { state: next, adSetDbId: decision.adsetId };
  }

  const perm = checkAutoPermission(config, 'new_adset');
  if (!perm.allowed) throw new Error(perm.reason);

  const campaignDraft =
    (next.draftCampaign as CampaignPreset | undefined) ??
    defaultCampaignDraft(next.adType ?? 'OUTCOME_TRAFFIC');

  next.draftAdset = buildAdsetDraftFromCampaign(campaignDraft, campaignDbId, next);
  const aligned = await alignAdsetPresetToCampaignSiblings(campaignDbId, next.draftAdset as AdsetPreset);
  next.draftAdset = aligned.draft;
  if (decision.dailyBudget) {
    next.draftAdset = {
      ...next.draftAdset,
      dailyBudget: String(decision.dailyBudget),
    };
  }
  if (decision.adsetName) {
    next.draftAdset = { ...next.draftAdset, name: decision.adsetName };
  }
  next.presetTarget = 'adset';
  next.campaignId = campaignDbId;

  const presetTurn = await runPresetChatTurn({
    target: 'adset',
    userText: `${userText}\nAd set budget: ${decision.dailyBudget ?? config.defaultDailyBudget ?? 2000} daily.`,
    state: next,
  });
  next.draftAdset = presetTurn.draftAdset;

  const postLlmAlign = await alignAdsetPresetToCampaignSiblings(
    campaignDbId,
    next.draftAdset as AdsetPreset,
  );
  next.draftAdset = postLlmAlign.draft;

  const campaignRow = await prisma.metaCampaign.findUnique({
    where: { id: campaignDbId },
    select: { objective: true },
  });

  const approved = await approveAdsetWithRecovery(
    companyId,
    campaignDbId,
    postLlmAlign.draft as AdsetPreset,
    next,
    campaignRow?.objective,
  );
  if (!approved.ok) throw new Error(approved.error);

  next.draftAdset = approved.draft;
  next.defaultAdSetId = approved.created.id;
  next.adsetPresetId = approved.presetId;
  return { state: next, adSetDbId: approved.created.id };
}

async function fillCreativesAndUpload(
  companyId: string,
  groups: GroupModel[],
  state: WorkflowState,
): Promise<{ groups: GroupModel[]; assetMetaCreativeIds: Record<string, string> }> {
  const adType = state.adType ?? 'OUTCOME_TRAFFIC';
  const tone = state.tone ?? 'general';
  const pixelId = state.pixelId ?? '';
  const assetMetaCreativeIds: Record<string, string> = {};

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { website: true },
  });
  const fallbackUrl = company?.website?.trim() || 'https://example.com';

  const nextGroups = groups.map((g) => ({ ...g, creative: { ...g.creative } }));

  for (const g of nextGroups.filter((x) => x.included)) {
    const assetId = g.assetIds[0];
    if (!assetId) continue;

    const suggestion = await creativeSuggestForAsset({
      companyId,
      assetId,
      adType,
      tone,
      groupLabel: g.label,
    });

    g.creative = {
      headline: suggestion.headline,
      primaryText: suggestion.primaryText,
      description: suggestion.description ?? '',
      landingUrl: suggestion.landingUrl?.trim() || fallbackUrl,
      ctaType: suggestion.ctaType,
      pixelId,
    };

    const stored = await storeAdCreativeForAsset({
      companyId,
      assetId,
      headline: g.creative.headline,
      primaryText: g.creative.primaryText,
      description: g.creative.description,
      landingUrl: g.creative.landingUrl,
      ctaType: g.creative.ctaType,
      pixelId: pixelId || null,
      metaCampaignId: state.campaignId ?? null,
    });
    assetMetaCreativeIds[assetId] = stored.id;
  }

  return { groups: nextGroups, assetMetaCreativeIds };
}

export async function runAutoAdsPipeline(
  input: AutoAdsPipelineInput,
): Promise<OrchestratorResult> {
  const { sessionId, companyId, userText, config } = input;
  const runId = newAutoPipelineRunId();
  let state: WorkflowState = {
    ...input.state,
    autoMode: true,
    autoPipelineRunId: runId,
    intentNotes: input.state.intentNotes ?? userText,
  };

  await updateChatSession(sessionId, companyId, {
    pathType: 'ADS',
    currentStep: 'campaignChoice',
    workflowState: state,
  });

  const newMessages: SerializedMessage[] = [];
  if (input.userMessageRow) newMessages.push(input.userMessageRow);

  if (config.mediaMode === 'manual_selection') {
    state.autoPipelineRunId = undefined;
    state.agentNextStep = 'choose_media';
    await updateChatSession(sessionId, companyId, {
      currentStep: 'mediaSource',
      workflowState: state,
    });
    newMessages.push(
      await assistantProgress(
        sessionId,
        'Auto mode is on, but your settings ask for manual media selection. Pick how to add creatives below.',
      ),
    );
    const session = await getChatSession(sessionId, companyId);
    return packageResult(session, newMessages);
  }

  const staticPerm = checkAutoPermission(config, 'static_generation');
  if (!staticPerm.allowed) {
    state.autoPipelineRunId = undefined;
    state.agentNextStep = 'choose_media';
    await updateChatSession(sessionId, companyId, {
      currentStep: 'mediaSource',
      workflowState: state,
    });
    newMessages.push(await assistantProgress(sessionId, staticPerm.reason));
    const session = await getChatSession(sessionId, companyId);
    return packageResult(session, newMessages);
  }

  try {
    if (!state.groups?.length) {
      newMessages.push(
        await assistantProgress(sessionId, 'Generating ad statics from your brand DNA…'),
      );
      const generated = await generateAutoAdsStatics({
        companyId,
        sessionId,
        userText,
        config,
        state,
      });
      state = generated.state;
    }

    newMessages.push(
      await assistantProgress(
        sessionId,
        `**${state.groups?.filter((g) => g.included).length ?? 0}** statics ready. Resolving campaign and ad set…`,
      ),
    );

    const integration = await prisma.metaIntegration.findUnique({
      where: { companyId },
      select: { id: true },
    });
    if (!integration) throw new Error('Connect Meta in Profile → Integrations first.');

    const campaigns = await syncCampaigns(integration.id);
    const campaignOptions = campaigns.map((c) => ({
      id: c.id,
      name: c.name ?? c.id,
      objective: c.objective ?? 'UNKNOWN',
    }));

    const pixel = await resolvePixel(companyId);
    state.hasPixel = pixel.hasPixel;
    state.pixelId = pixel.pixelId;

    const rawDecision = await decideCampaignAdset({
      userText,
      campaigns: campaignOptions,
      adsets: [],
      hasPixel: pixel.hasPixel,
      pixelId: pixel.pixelId,
      config,
      intentNotes: state.intentNotes,
    });
    const decision = validateCampaignAdsetDecision(
      rawDecision,
      campaignOptions,
      [],
      pixel.hasPixel,
    );

    const { state: afterCampaign, campaignDbId } = await applyCampaignDecision(
      companyId,
      state,
      decision,
      userText,
      config,
    );
    state = afterCampaign;

    const adsets = await syncAdSets({
      metaIntegrationId: integration.id,
      campaignDbId,
    });
    const adsetOptions = adsets.map((a) => ({
      id: a.id,
      name: a.name ?? a.id,
      campaignId: campaignDbId,
      optimizationGoal: a.optimizationGoal,
      billingEvent: a.billingEvent,
    }));

    const convention = await getCampaignAdSetConvention(campaignDbId);
    const adsetRawDecision = await decideCampaignAdset({
      userText,
      campaigns: campaignOptions,
      adsets: adsetOptions,
      hasPixel: pixel.hasPixel,
      pixelId: pixel.pixelId,
      config,
      intentNotes: state.intentNotes,
      campaignAdSetConvention: convention ? formatConventionForLlm(convention) : null,
    });

    const adsetDecision = validateCampaignAdsetDecision(
      {
        ...adsetRawDecision,
        campaignId: campaignDbId,
        campaignAction: 'use_existing',
      },
      campaignOptions,
      adsetOptions,
      pixel.hasPixel,
    );

    const { state: afterAdset, adSetDbId } = await applyAdsetDecision(
      companyId,
      state,
      adsetDecision,
      userText,
      campaignDbId,
      config,
    );
    state = afterAdset;

    newMessages.push(
      await assistantProgress(
        sessionId,
        'Analyzing media and uploading Meta creatives…',
      ),
    );

    const groups = (state.groups ?? []).map((g) => ({
      ...g,
      adSetId: adSetDbId,
    }));

    const { groups: filledGroups, assetMetaCreativeIds } = await fillCreativesAndUpload(
      companyId,
      groups,
      state,
    );
    state.groups = filledGroups;
    state.assetMetaCreativeIds = assetMetaCreativeIds;

    const included = filledGroups.filter((g) => g.included && g.assetIds[0]);

    if (config.autoPost) {
      const jobIds = await enqueueBulkPublish({
        companyId,
        campaignId: campaignDbId,
        groups: included.map((g) => ({
          bucketId: g.bucketId,
          assetIds: g.assetIds,
          adSetId: adSetDbId,
          headline: g.creative.headline,
          primaryText: g.creative.primaryText,
          description: g.creative.description || undefined,
          landingUrl: g.creative.landingUrl,
          ctaType: g.creative.ctaType,
          pixelId: g.creative.pixelId || undefined,
          assetCreatives: Object.fromEntries(
            g.assetIds
              .filter((id) => assetMetaCreativeIds[id])
              .map((id) => [id, assetMetaCreativeIds[id]!]),
          ),
        })),
      });
      state.publishJobIds = jobIds;
      await runPublishWorkerForCompany(companyId);

      await updateChatSession(sessionId, companyId, {
        status: 'COMPLETED',
        currentStep: 'done',
        workflowState: state,
        campaignId: campaignDbId,
      });

      newMessages.push(
        await assistantProgress(
          sessionId,
          `Queued **${jobIds.length}** ad${jobIds.length === 1 ? '' : 's'} for publishing on Meta. View progress in Ad History.`,
        ),
      );
    } else {
      const draftIds = await enqueueDraftJobs({
        companyId,
        jobs: included.flatMap((g) => {
          const assetId = g.assetIds[0];
          if (!assetId) return [];
          const creativeId = assetMetaCreativeIds[assetId];
          if (!creativeId) return [];
          return [
            {
              campaignId: campaignDbId,
              adSetId: adSetDbId,
              assetId,
              metaCreativeDbId: creativeId,
              headline: g.creative.headline,
              primaryText: g.creative.primaryText,
              description: g.creative.description,
              landingUrl: g.creative.landingUrl,
              ctaType: g.creative.ctaType,
              pixelId: g.creative.pixelId || null,
              groupKey: g.bucketId,
            },
          ];
        }),
      });
      state.publishJobIds = draftIds;

      await updateChatSession(sessionId, companyId, {
        status: 'COMPLETED',
        currentStep: 'done',
        workflowState: state,
        campaignId: campaignDbId,
      });

      newMessages.push(
        await assistantProgress(
          sessionId,
          `**${draftIds.length}** ad${draftIds.length === 1 ? '' : 's'} drafted with Meta creatives ready. Review and publish from [Pending Ads](/manager/pending).`,
        ),
      );
    }

    const session = await getChatSession(sessionId, companyId);
    return packageResult(session, newMessages);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state.autoPipelineRunId = undefined;
    state.lastOperationError = message;
    await updateChatSession(sessionId, companyId, {
      workflowState: state,
      currentStep: 'campaignChoice',
    });
    newMessages.push(
      await assistantProgress(
        sessionId,
        `Auto pipeline paused: ${message}\n\nContinue manually with the options below.`,
      ),
    );
    const session = await getChatSession(sessionId, companyId);
    return packageResult(session, newMessages);
  }
}
