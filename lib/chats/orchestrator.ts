import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { prisma } from '@/lib/prisma';
import { enqueueBulkPublish } from '@/lib/meta/process-publish-jobs';

import { classifyTopLevelPath } from '@/lib/image-gen/classify-top-level';
import {
  handleImageGenAction,
  handleImageGenMessage,
  initImageGenFromFirstMessage,
} from '@/lib/image-gen/orchestrator';
import { parseImageGenState } from '@/lib/image-gen/state';
import type { ImageGenActionType } from '@/lib/image-gen/types';
import { IMAGE_GEN_ACTIONS } from '@/lib/image-gen/types';
import {
  handleVideoGenAction,
  handleVideoGenMessage,
  initVideoGenFromFirstMessage,
} from '@/lib/video-gen/orchestrator';
import { handleGeoChatAction } from '@/lib/geo/chat/handle-geo-action';
import { handleGeoMessage, initGeoFromFirstMessage } from '@/lib/geo/chat/orchestrator';
import { parseVideoGenState } from '@/lib/video-gen/state';
import type { VideoGenActionType } from '@/lib/video-gen/types';
import { VIDEO_GEN_ACTIONS } from '@/lib/video-gen/types';

import { runAdAgentTurn } from './agent-turn';
import { buildGuidedReply } from './guided-replies';
import { approveAdsetWithRecovery, approveCampaignWithRecovery } from './approve-with-recovery';
import { resolveActionUserMessage } from './action-user-message';
import { shouldSkipActionUserBubble } from './user-message-policy';
import { isCampaignObjectiveAllowed } from './campaign-objective-rules';
import { tryHandleAdsEmptyPickerTurn } from './handle-empty-picker-turn';
import { executeAgentPlan } from './execute-agent-plan';
import { handleGoogleChatAction } from './google-action-handler';
import {
  buildAdsetDraftFromCampaign,
  defaultAdsetDraft,
  defaultCampaignDraft,
  workflowHasPixel,
} from './preset-drafts';
import { getStepResumePrompt } from './step-prompts';
import {
  applyGoBackStateReset,
  getBackStepOptions,
  isAllowedBackStep,
} from './workflow-navigation';
import { loadGroupsForBulk } from './load-groups';
import {
  appendChatMessages,
  getChatSession,
  settleAnalyzingMessages,
  settleCreativeBuildingMessages,
  updateChatSession,
  type DbChatSession,
} from './repository';
import { parseWorkflowState, serializeMessage, serializeSession } from './serialize';
import type {
  ChatActionType,
  ChatWorkflowStep,
  OrchestratorResult,
  SerializedMessage,
  WidgetType,
  WorkflowState,
} from './types';

function hasCreativesReady(state: WorkflowState): boolean {
  return Boolean(state.bulkUploadId || (state.groups?.length ?? 0) > 0);
}

async function resolveCampaignDraftForAdset(
  state: WorkflowState,
  companyId: string,
): Promise<CampaignPreset> {
  if (state.draftCampaign && typeof state.draftCampaign === 'object') {
    return state.draftCampaign as CampaignPreset;
  }
  if (state.campaignId) {
    const row = await prisma.metaCampaign.findFirst({
      where: { id: state.campaignId, metaIntegration: { companyId } },
      select: {
        name: true,
        objective: true,
        status: true,
        dailyBudget: true,
        lifetimeBudget: true,
        spendCap: true,
        bidStrategy: true,
        specialAdCategories: true,
      },
    });
    if (row) {
      const daily = row.dailyBudget > 0 ? String(row.dailyBudget) : null;
      const lifetime = row.lifetimeBudget != null ? String(row.lifetimeBudget) : null;
      return {
        ...defaultCampaignDraft(),
        name: row.name,
        objective: row.objective,
        status: row.status,
        dailyBudget: daily,
        lifetimeBudget: lifetime,
        spendCap: row.spendCap != null ? String(row.spendCap) : null,
        bidStrategy: row.bidStrategy,
        specialAdCategories: Array.isArray(row.specialAdCategories)
          ? (row.specialAdCategories as string[])
          : [],
      };
    }
  }
  return defaultCampaignDraft();
}

async function assistantMsg(
  sessionId: string,
  content: string,
  widgetType?: WidgetType | null,
  widgetPayload?: unknown,
): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [
    {
      role: 'ASSISTANT',
      content,
      widgetType: widgetType ?? null,
      widgetPayload,
    },
  ]);
  return serializeMessage(row);
}

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function persistSession(
  session: DbChatSession,
  step: ChatWorkflowStep,
  state: WorkflowState,
  extra?: { title?: string; status?: string; bulkUploadId?: string | null; campaignId?: string | null },
) {
  await updateChatSession(session.id, session.companyId, {
    currentStep: step,
    workflowState: state,
    ...extra,
  });
}

function packageOrchestratorResult(
  serialized: ReturnType<typeof serializeSession>,
  nextStep: ChatWorkflowStep,
  nextState: WorkflowState,
  newMessages: SerializedMessage[],
  meta?: { recoveredFromError?: boolean },
): OrchestratorResult {
  const operationError = nextState.lastOperationError ?? null;
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: nextStep,
      workflowState: nextState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
    operationError,
    statusTone: operationError ? 'fixing' : undefined,
    recoveredFromError: meta?.recoveredFromError,
  };
}

function sessionPathType(session: DbChatSession): 'ADS' | 'IMAGE_GEN' | 'VIDEO_GEN' | 'GEO' | null {
  const pt = (session as DbChatSession & { pathType?: string | null }).pathType;
  if (pt === 'IMAGE_GEN') return 'IMAGE_GEN';
  if (pt === 'VIDEO_GEN') return 'VIDEO_GEN';
  if (pt === 'GEO') return 'GEO';
  if (pt === 'ADS') return 'ADS';
  const state = parseWorkflowState(session.workflowState);
  if (parseVideoGenState(state)) return 'VIDEO_GEN';
  if (parseImageGenState(state)) return 'IMAGE_GEN';
  return null;
}

export async function handleChatMessage(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const state = parseWorkflowState(session.workflowState);
  const step = session.currentStep as ChatWorkflowStep;
  const priorMessages = (session.messages ?? []).map(serializeMessage);
  const pathType = sessionPathType(session);

  if (!session.title || session.title === 'New chat') {
    const title = text.trim().slice(0, 80) || 'Ad chat';
    await updateChatSession(sessionId, companyId, { title });
  }

  if (pathType === 'IMAGE_GEN' || step === 'imageGen') {
    return handleImageGenMessage(sessionId, companyId, text);
  }

  if (pathType === 'VIDEO_GEN' || step === 'videoGen') {
    return handleVideoGenMessage(sessionId, companyId, text);
  }

  if (pathType === 'GEO' || step === 'geo') {
    return handleGeoMessage(sessionId, companyId, text);
  }

  if (pathType === null && step === 'intent') {
    const route = await classifyTopLevelPath(text);
    if (route === 'geo') {
      await userMsg(sessionId, text);
      await updateChatSession(sessionId, companyId, { pathType: 'GEO' });
      const refreshed = await getChatSession(sessionId, companyId);
      if (!refreshed) throw new Error('Session not found');
      return initGeoFromFirstMessage(sessionId, companyId, text);
    }
    if (route === 'imageGen') {
      await userMsg(sessionId, text);
      await updateChatSession(sessionId, companyId, { pathType: 'IMAGE_GEN' });
      const refreshed = await getChatSession(sessionId, companyId);
      if (!refreshed) throw new Error('Session not found');
      return initImageGenFromFirstMessage(refreshed, state, text);
    }
    if (route === 'videoGen') {
      await userMsg(sessionId, text);
      await updateChatSession(sessionId, companyId, { pathType: 'VIDEO_GEN' });
      const refreshed = await getChatSession(sessionId, companyId);
      if (!refreshed) throw new Error('Session not found');
      return initVideoGenFromFirstMessage(refreshed, state, text);
    }
    await updateChatSession(sessionId, companyId, { pathType: 'ADS' });
  }

  const emptyPickerResult = await tryHandleAdsEmptyPickerTurn(sessionId, companyId, text);
  if (emptyPickerResult) return emptyPickerResult;

  const { tryHandleAdsWidgetChoiceTurn } = await import('@/lib/chats/handle-widget-choice-turn');
  const widgetChoiceResult = await tryHandleAdsWidgetChoiceTurn(sessionId, companyId, text);
  if (widgetChoiceResult) return widgetChoiceResult;

  const userRow = await userMsg(sessionId, text);

  const plan = await runAdAgentTurn({
    userText: text,
    state,
    currentStep: step,
    priorMessages,
  });

  return executeAgentPlan({
    sessionId,
    companyId,
    plan,
    userRow,
    userText: text,
  });
}

export type HandleChatActionOptions = {
  /** When true, update workflow only — no chat rows (agent turn emits one reply). */
  silent?: boolean;
};

export async function handleChatAction(
  sessionId: string,
  companyId: string,
  action: ChatActionType,
  payload: Record<string, unknown>,
  userMessage?: string | null,
  options?: HandleChatActionOptions,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  if (sessionPathType(session) === 'GEO' || session.currentStep === 'geo') {
    if (action === 'geo.redditTargetPicked') {
      return handleGeoChatAction(sessionId, companyId, action, payload, userMessage);
    }
    const serialized = serializeSession(session);
    return {
      session: {
        id: serialized.id,
        title: serialized.title,
        status: serialized.status,
        currentStep: 'geo',
        workflowState: serialized.workflowState,
        bulkUploadId: serialized.bulkUploadId,
        campaignId: serialized.campaignId,
      },
      messages: serialized.messages,
      newMessages: [],
    };
  }

  if (
    VIDEO_GEN_ACTIONS.includes(action as VideoGenActionType) ||
    sessionPathType(session) === 'VIDEO_GEN' ||
    session.currentStep === 'videoGen'
  ) {
    return handleVideoGenAction(
      sessionId,
      companyId,
      action as VideoGenActionType,
      payload,
      userMessage,
    );
  }

  if (
    IMAGE_GEN_ACTIONS.includes(action as ImageGenActionType) ||
    sessionPathType(session) === 'IMAGE_GEN' ||
    session.currentStep === 'imageGen'
  ) {
    return handleImageGenAction(
      sessionId,
      companyId,
      action as ImageGenActionType,
      payload,
      userMessage,
    );
  }

  const state = parseWorkflowState(session.workflowState);
  const newMessages: SerializedMessage[] = [];
  let nextStep = session.currentStep as ChatWorkflowStep;
  let nextState = { ...state };
  let recoveredFromError = false;

  // ── Google Ads action routing ────────────────────────────────────────────
  const GOOGLE_ACTIONS: ChatActionType[] = [
    'platform.selected',
    'google.campaignTypeSelected',
    'google.campaignSelected',
    'google.adGroupSelected',
    'google.creativeSubmitted',
    'google.publish.submit',
  ];

  if (GOOGLE_ACTIONS.includes(action)) {
    return handleGoogleChatAction({
      sessionId,
      companyId,
      session,
      action,
      payload,
      userMessage,
      options,
      state,
      newMessages,
      nextStep,
      nextState,
    });
  }
  // ── End Google routing ───────────────────────────────────────────────────

  const displayUserText =
    userMessage?.trim() || resolveActionUserMessage(action, payload) || null;
  if (
    displayUserText &&
    action !== 'creative.aiDone' &&
    !options?.silent &&
    !shouldSkipActionUserBubble(session.messages, action)
  ) {
    newMessages.push(await userMsg(sessionId, displayUserText));
  }

  const silent = options?.silent === true;
  const say = async (
    content: string,
    widgetType?: WidgetType | null,
    widgetPayload?: unknown,
  ) => {
    if (silent) return;
    newMessages.push(await assistantMsg(sessionId, content, widgetType ?? undefined, widgetPayload));
  };

  switch (action) {
    case 'intent.ack': {
      if (hasCreativesReady(nextState)) {
        nextStep = 'campaignChoice';
        await say("Your creatives are already in — let's set up your campaign.",'campaignChoice');
        break;
      }
      nextStep = 'mediaSource';
      await say("Let's build your ad. How would you like to add your creatives?",'mediaSource');
      break;
    }

    case 'media.source': {
      if (hasCreativesReady(nextState)) {
        nextStep = 'campaignChoice';
        await say("Your creatives are already in — let's set up your campaign.",'campaignChoice');
        break;
      }
      const source = payload.source as string;
      if (source === 'gallery') {
        nextStep = 'mediaPick';
        await say('Pick a bulk folder or creatives from your gallery.', 'mediaPick');
      } else {
        nextStep = 'mediaUpload';
        await say("Drop your images and videos here. I'll group them once processing finishes.",'mediaUpload');
      }
      break;
    }

    case 'media.uploaded':
    case 'media.galleryPicked': {
      const bulkUploadId = String(payload.bulkUploadId ?? '');
      const assetIds = Array.isArray(payload.assetIds)
        ? (payload.assetIds as string[])
        : [];
      nextState.bulkUploadId = bulkUploadId;
      nextState.assetIds = assetIds;
      await persistSession(session, 'mediaAnalyze', nextState, { bulkUploadId });
      return handleChatAction(sessionId, companyId, 'media.analyzed', { bulkUploadId }, undefined, options);
    }

    case 'media.analyzed': {
      const bulkUploadId = String(payload.bulkUploadId ?? nextState.bulkUploadId ?? '');
      const existingBuckets = await prisma.assetBucket.count({
        where: { bulkUploadId, companyId },
      });
      const { groups } = await loadGroupsForBulk(bulkUploadId, companyId, {
        runContentAnalyze: existingBuckets === 0,
      });
      nextState.bulkUploadId = bulkUploadId;
      nextState.groups = groups;
      nextStep = 'campaignChoice';
      nextState.agentNextStep = 'setup_campaign';
      await settleAnalyzingMessages(sessionId, { groupCount: groups.length });
      await say(buildGuidedReply('setup_campaign', nextState), 'campaignChoice');
      await persistSession(session, nextStep, nextState, { bulkUploadId });
      break;
    }

    case 'campaign.choice': {
      const choice = payload.choice as string;
      if (choice === 'existing') {
        nextStep = 'campaignSelect';
        await say('Choose an existing campaign:', 'campaignPicker', {
            mode: 'campaign',
          });
      } else {
        nextStep = 'pixelSetup';
        delete nextState.hasPixel;
        delete nextState.pixelId;
        delete nextState.trafficOptimizationGoal;
        await say('Before we build your campaign — **do you have a Meta Pixel ID?** Conversion campaigns (Sales, website Leads) need one. You can still run Traffic, Engagement, or Awareness without a pixel.','pixelQuestion');
      }
      break;
    }

    case 'pixel.answered': {
      const hasPixel = Boolean(payload.hasPixel);
      const pixelId =
        typeof payload.pixelId === 'string' && payload.pixelId.trim()
          ? payload.pixelId.trim()
          : null;
      nextState.hasPixel = hasPixel || Boolean(pixelId);
      nextState.pixelId = pixelId;
      nextStep = 'campaignObjective';
      const hint = nextState.hasPixel
        ? 'Great — pick a campaign objective below, then tell me your budget and schedule.'
        : 'No pixel — Sales and website Leads are disabled. Pick Traffic, Engagement, Awareness, or App promotion.';
      await say(hint, 'campaignObjective', {
          hasPixel: nextState.hasPixel,
        });
      break;
    }

    case 'campaign.objectivePicked': {
      const objective = String(payload.objective ?? '');
      const trafficGoal = payload.trafficOptimizationGoal as
        | 'LINK_CLICKS'
        | 'LANDING_PAGE_VIEWS'
        | undefined;
      if (!objective) break;

      if (!isCampaignObjectiveAllowed(objective, workflowHasPixel(nextState))) {
        await say('That objective needs a Meta Pixel. Add your pixel ID above or pick Traffic, Engagement, or Awareness.',
            'campaignObjective',
            { hasPixel: nextState.hasPixel },
          );
        nextStep = 'campaignObjective';
        break;
      }

      nextState.draftCampaign = defaultCampaignDraft(objective);
      nextState.adType = objective;
      if (trafficGoal) nextState.trafficOptimizationGoal = trafficGoal;
      nextState.presetChatMessages = [];
      nextState.presetTarget = 'campaign';
      nextStep = 'campaignPreset';

      const goalNote =
        objective === 'OUTCOME_TRAFFIC' && trafficGoal
          ? ` (optimize for **${trafficGoal === 'LANDING_PAGE_VIEWS' ? 'landing page views' : 'link clicks'}**)`
          : '';
      await say(`**${objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ')}** selected${goalNote}. Tell me your budget, schedule, and any targeting preferences — I'll draft the campaign preset.`, 'campaignPreset', { objective, hasPixel: nextState.hasPixel });
      break;
    }

    case 'campaign.selected': {
      const campaignId = String(payload.campaignId ?? '');
      nextState.campaignId = campaignId;
      nextStep = 'adsetChoice';
      await say('Campaign selected. Do you want an existing ad set or create a new one?',
          'adsetChoice',
          { campaignId },
        );
      await persistSession(session, nextStep, nextState, { campaignId });
      break;
    }

    case 'campaign.presetUpdated': {
      if (payload.draft) nextState.draftCampaign = payload.draft as Partial<CampaignPreset>;
      break;
    }

    case 'campaign.approved': {
      const draft = (nextState.draftCampaign ?? defaultCampaignDraft()) as CampaignPreset;
      const result = await approveCampaignWithRecovery(companyId, draft, nextState);
      nextState.draftCampaign = result.draft;

      if (!result.ok) {
        nextState.lastOperationError = result.error;
        nextStep = 'campaignApprove';
        const approveHint =
          '\n\nIf this looks right, say **approve** or use the button below.';
        await say((result.reply ?? 'Please review the updated campaign preset.') + approveHint, 'presetPreview', {
              target: 'campaign',
              campaign: nextState.draftCampaign,
              adset: null,
            });
        break;
      }

      delete nextState.lastOperationError;
      recoveredFromError = result.recovered;
      nextState.campaignPresetId = result.presetId;
      nextState.campaignId = result.created.id;
      nextStep = 'adsetChoice';
      const intro = result.recovered
        ? `Campaign **${result.created.name}** created after I fixed a Meta validation issue. Existing ad set or create new?`
        : `Campaign **${result.created.name}** created. Existing ad set or create new?`;
      await say(intro, 'adsetChoice', { campaignId: result.created.id });
      await persistSession(session, nextStep, nextState, { campaignId: result.created.id });
      break;
    }

    case 'adset.choice': {
      const choice = payload.choice as string;
      if (choice === 'existing') {
        nextStep = 'adsetSelect';
        await say('Choose an ad set for your ads:', 'adsetPicker', {
            campaignId: nextState.campaignId,
          });
      } else {
        nextStep = 'adsetPreset';
        const campaignDraft = await resolveCampaignDraftForAdset(nextState, companyId);
        nextState.draftCampaign = campaignDraft;
        nextState.draftAdset = buildAdsetDraftFromCampaign(
          campaignDraft,
          nextState.campaignId,
          nextState,
        );
        nextState.presetChatMessages = [];
        nextState.presetTarget = 'adset';
        await say('Describe your ad set — budget, schedule, audience, and optimization. I will align it with your campaign settings.','adsetPreset');
      }
      break;
    }

    case 'workflow.goBack': {
      const targetStep = payload.step as ChatWorkflowStep | undefined;
      const current = session.currentStep as ChatWorkflowStep;

      if (!targetStep) {
        const options = getBackStepOptions(current, nextState);
        nextStep = current;
        await say('Which step would you like to go back to?', 'stepNav', {
            options,
          });
        break;
      }

      if (!isAllowedBackStep(current, targetStep, nextState)) {
        await say("You can't jump to that step from here. Pick another option.");
        break;
      }

      nextState = applyGoBackStateReset(targetStep, nextState);
      nextStep = targetStep;

      if (targetStep === 'campaignPreset' && !nextState.draftCampaign) {
        nextState.draftCampaign = defaultCampaignDraft();
        nextState.presetChatMessages = [];
        nextState.presetTarget = 'campaign';
      }
      if (targetStep === 'adsetPreset') {
        const campaignDraft = await resolveCampaignDraftForAdset(nextState, companyId);
        nextState.draftCampaign = campaignDraft;
        nextState.draftAdset = buildAdsetDraftFromCampaign(
          campaignDraft,
          nextState.campaignId,
          nextState,
        );
        nextState.presetChatMessages = [];
        nextState.presetTarget = 'adset';
      }

      const { content, widgetType } = getStepResumePrompt(targetStep);
      const widgetPayload: Record<string, unknown> = {};
      if (widgetType === 'adsetPicker') {
        widgetPayload.campaignId = nextState.campaignId;
      }
      if (widgetType === 'presetPreview') {
        const t = nextState.presetTarget ?? 'campaign';
        widgetPayload.target = t;
        widgetPayload.campaign = nextState.draftCampaign;
        widgetPayload.adset = t === 'adset' ? nextState.draftAdset : null;
      }
      if (widgetType === 'adPreview') {
        widgetPayload.groups = nextState.groups;
      }

      await say(content, widgetType ?? undefined, widgetPayload);
      await persistSession(session, nextStep, nextState, {
        campaignId: nextState.campaignId ?? null,
      });
      break;
    }

    case 'adset.selected': {
      const adSetId = String(payload.adSetId ?? '');
      nextState.defaultAdSetId = adSetId;
      if (nextState.groups) {
        nextState.groups = nextState.groups.map((g) => ({ ...g, adSetId }));
      }
      nextStep = 'creativeMode';
      await say('How should we fill in ad copy for each creative group?','creativeMode');
      break;
    }

    case 'adset.approved': {
      const draft = (nextState.draftAdset ?? defaultAdsetDraft()) as AdsetPreset;
      const campaignId = nextState.campaignId;
      if (!campaignId) throw new Error('Missing campaign');

      const campaignDraft = await resolveCampaignDraftForAdset(nextState, companyId);
      const result = await approveAdsetWithRecovery(
        companyId,
        campaignId,
        draft,
        nextState,
        campaignDraft.objective,
      );
      nextState.draftAdset = result.draft;
      nextState.draftCampaign = campaignDraft;

      if (!result.ok) {
        nextState.lastOperationError = result.error;
        nextStep = 'adsetApprove';
        const approveHint =
          '\n\nIf this looks right, say **approve** or use the button below.';
        await say((result.reply ?? 'Please review the updated ad set preset.') + approveHint, 'presetPreview', {
              target: 'adset',
              campaign: nextState.draftCampaign,
              adset: nextState.draftAdset,
            });
        break;
      }

      delete nextState.lastOperationError;
      recoveredFromError = result.recovered;
      nextState.adsetPresetId = result.presetId;
      nextState.defaultAdSetId = result.created.id;
      if (nextState.groups) {
        nextState.groups = nextState.groups.map((g) => ({ ...g, adSetId: result.created.id }));
      }
      nextStep = 'creativeMode';
      const intro = result.recovered
        ? `Ad set **${result.created.name}** is ready — I fixed conversion tracking / pixel settings. How should we write your ad copy?`
        : `Ad set **${result.created.name}** is ready. How should we write your ad copy?`;
      await say(intro, 'creativeMode');
      break;
    }

    case 'creative.mode': {
      const mode = payload.mode as 'ai' | 'csv';
      nextState.creativeMode = mode;
      if (mode === 'csv') {
        nextStep = 'creativeCsv';
        await say('Upload a CSV with columns: groupKey, headline, primaryText, landingUrl, ctaType (optional).','creativeCsv');
      } else {
        nextStep = 'creativeBuild';
        console.log('[chats:creative-ai] creative.mode → creativeBuild', {
          sessionId,
          groupCount: nextState.groups?.length ?? 0,
          included: nextState.groups?.filter((g) => g.included).length ?? 0,
        });
        await say('Generating ad copy for each group with AI…','creativeBuilding');
      }
      break;
    }

    case 'creative.csvParsed': {
      const rows = payload.groups as Array<{
        bucketId: string;
        creative: Record<string, string>;
      }>;
      if (nextState.groups && rows?.length) {
        const byId = new Map(rows.map((r) => [r.bucketId, r.creative]));
        nextState.groups = nextState.groups.map((g) => {
          const patch = byId.get(g.bucketId);
          if (!patch) return g;
          return {
            ...g,
            creative: {
              ...g.creative,
              headline: patch.headline ?? g.creative.headline,
              primaryText: patch.primaryText ?? g.creative.primaryText,
              landingUrl: patch.landingUrl ?? g.creative.landingUrl,
              ctaType: patch.ctaType ?? g.creative.ctaType,
              description: patch.description ?? g.creative.description,
            },
          };
        });
      }
      nextStep = 'preview';
      await say('Here is your ad preview. Approve or request changes.', 'adPreview', {
          groups: nextState.groups,
        });
      break;
    }

    case 'creative.aiDone': {
      const incoming = payload.groups as typeof nextState.groups | undefined;
      console.log('[chats:creative-ai] creative.aiDone received', {
        sessionId,
        incomingCount: incoming?.length ?? 0,
        withHeadline: incoming?.filter((g) => g.creative?.headline?.trim()).length ?? 0,
      });
      if (incoming) nextState.groups = incoming;
      nextStep = 'preview';
      await settleCreativeBuildingMessages(sessionId);
      await say('Here is your ad preview. Approve or request changes.', 'adPreview', {
          groups: nextState.groups,
        });
      break;
    }

    case 'preview.changes': {
      nextStep = 'creativeBuild';
      await say('Tell me what to change, or use AI regenerate on the next card.','creativeBuilding');
      break;
    }

    case 'preview.approved': {
      nextStep = 'publishChoice';
      await say('Ready to publish. Post immediately or schedule for later?','publishSchedule');
      break;
    }

    case 'publish.submit': {
      const scheduledAt = payload.scheduledAt as string | undefined;
      const campaignId = nextState.campaignId;
      const groups = (nextState.groups ?? []).filter((g) => g.included);
      if (!campaignId || groups.length === 0) throw new Error('Missing campaign or groups');

      const jobIds = await enqueueBulkPublish({
        companyId,
        campaignId,
        scheduledAt: scheduledAt || undefined,
        groups: groups.map((g) => ({
          bucketId: g.bucketId,
          assetIds: g.assetIds,
          adSetId: g.adSetId,
          headline: g.creative.headline,
          primaryText: g.creative.primaryText,
          description: g.creative.description || undefined,
          landingUrl: g.creative.landingUrl,
          ctaType: g.creative.ctaType,
          pixelId: g.creative.pixelId || undefined,
        })),
      });
      nextState.publishJobIds = jobIds;
      nextStep = 'done';
      await updateChatSession(sessionId, companyId, {
        status: 'COMPLETED',
        currentStep: nextStep,
        workflowState: nextState,
      });
      await say(`Queued **${jobIds.length}** ad${jobIds.length === 1 ? '' : 's'} for publishing. View progress in Ad History.`,
          'done',
          { jobIds },
        );
      const refreshed = await getChatSession(sessionId, companyId);
      const serialized = serializeSession(refreshed!);
      return {
        session: {
          id: serialized.id,
          title: serialized.title,
          status: serialized.status,
          currentStep: nextStep,
          workflowState: nextState,
          bulkUploadId: serialized.bulkUploadId,
          campaignId: serialized.campaignId,
        },
        messages: serialized.messages,
        newMessages,
      };
    }

    default:
      await say('Unknown action.');
  }

  await persistSession(session, nextStep, nextState);
  const refreshed = await getChatSession(sessionId, companyId);
  const serialized = serializeSession(refreshed!);
  return packageOrchestratorResult(serialized, nextStep, nextState, newMessages, {
    recoveredFromError,
  });
}
