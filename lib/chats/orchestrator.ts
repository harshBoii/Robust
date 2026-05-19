import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { resolvePresetChatAdType, resolvePresetChatTone } from '@/lib/assistant/preset-chat-prompt';
import { prisma } from '@/lib/prisma';
import { enqueueBulkPublish } from '@/lib/meta/process-publish-jobs';

import { approveAdsetWithRecovery, approveCampaignWithRecovery } from './approve-with-recovery';
import { resolveActionUserMessage } from './action-user-message';
import { isCampaignObjectiveAllowed } from './campaign-objective-rules';
import {
  buildAdsetDraftFromCampaign,
  defaultAdsetDraft,
  defaultCampaignDraft,
  workflowHasPixel,
} from './preset-drafts';
import { runPresetChatTurn } from './preset-chat-turn';
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

function matchNaturalLanguageAction(
  step: ChatWorkflowStep,
  text: string,
): { action: import('./types').ChatActionType; payload: Record<string, unknown> } | null {
  const t = text.trim().toLowerCase();
  if (step === 'mediaSource') {
    if (/upload|drop|files|here/.test(t)) return { action: 'media.source', payload: { source: 'upload' } };
    if (/gallery|existing|folder|pick/.test(t)) return { action: 'media.source', payload: { source: 'gallery' } };
    if (/bulk/.test(t)) return { action: 'media.source', payload: { source: 'bulk' } };
  }
  if (step === 'campaignChoice') {
    if (/existing|current|already|use existing/.test(t)) {
      return { action: 'campaign.choice', payload: { choice: 'existing' } };
    }
    if (/new campaign|create new|from scratch|^new$|^create$|create a new/.test(t)) {
      return { action: 'campaign.choice', payload: { choice: 'new' } };
    }
  }
  if (step === 'adsetChoice') {
    if (/existing|current|already|use existing/.test(t)) {
      return { action: 'adset.choice', payload: { choice: 'existing' } };
    }
    if (/new ad set|create new|from scratch|^new$|^create$|create a new/.test(t)) {
      return { action: 'adset.choice', payload: { choice: 'new' } };
    }
  }
  if (step === 'campaignApprove') {
    if (/approve|looks good|yes|go ahead|confirm/.test(t)) {
      return { action: 'campaign.approved', payload: {} };
    }
  }
  if (step === 'adsetApprove') {
    if (/approve|looks good|yes|go ahead|confirm/.test(t)) {
      return { action: 'adset.approved', payload: {} };
    }
  }
  if (step === 'creativeMode') {
    if (/ai|generate|write/.test(t)) return { action: 'creative.mode', payload: { mode: 'ai' } };
    if (/csv|spreadsheet|upload/.test(t)) return { action: 'creative.mode', payload: { mode: 'csv' } };
  }
  if (step === 'preview') {
    if (/approve|looks good|publish|ship|go/.test(t)) return { action: 'preview.approved', payload: {} };
    if (/change|edit|fix|redo/.test(t)) return { action: 'preview.changes', payload: {} };
  }
  return null;
}

function matchGoBackIntent(
  step: ChatWorkflowStep,
  text: string,
  state: WorkflowState,
): { action: 'workflow.goBack'; payload: { step?: ChatWorkflowStep } } | null {
  const t = text.trim().toLowerCase();
  if (!/go back|previous step|start over|change (media|creatives|campaign|ad ?set)|redo (media|campaign)/.test(t)) {
    return null;
  }
  const options = getBackStepOptions(step, state);
  if (options.length === 0) return null;

  if (/media|creative|upload|gallery/.test(t)) {
    const hit = options.find((o) => o.step === 'mediaSource');
    if (hit) return { action: 'workflow.goBack', payload: { step: hit.step } };
  }
  if (/campaign/.test(t) && !/ad ?set/.test(t)) {
    const hit = options.find((o) => o.step === 'campaignChoice');
    if (hit) return { action: 'workflow.goBack', payload: { step: hit.step } };
  }
  if (/ad ?set/.test(t)) {
    const hit = options.find((o) => o.step === 'adsetChoice');
    if (hit) return { action: 'workflow.goBack', payload: { step: hit.step } };
  }
  if (/copy|creative/.test(t)) {
    const hit = options.find((o) => o.step === 'creativeMode');
    if (hit) return { action: 'workflow.goBack', payload: { step: hit.step } };
  }

  if (options.length === 1) {
    return { action: 'workflow.goBack', payload: { step: options[0].step } };
  }
  return { action: 'workflow.goBack', payload: {} };
}

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

export async function handleChatMessage(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const state = parseWorkflowState(session.workflowState);
  const step = session.currentStep as ChatWorkflowStep;
  const newMessages: SerializedMessage[] = [];

  const userRow = await userMsg(sessionId, text);
  newMessages.push(userRow);

  const nlAction = matchNaturalLanguageAction(step, text);
  if (nlAction) {
    const result = await handleChatAction(sessionId, companyId, nlAction.action, nlAction.payload);
    return { ...result, newMessages: [userRow, ...result.newMessages] };
  }

  const backAction = matchGoBackIntent(step, text, state);
  if (backAction) {
    const result = await handleChatAction(sessionId, companyId, backAction.action, backAction.payload);
    return { ...result, newMessages: [userRow, ...result.newMessages] };
  }

  let nextStep = step;
  let nextState = { ...state };

  // Media is only chosen once at the start (intent). Never re-ask after groups exist.
  if (step === 'intent') {
    if (!session.title || session.title === 'New chat') {
      const title = text.trim().slice(0, 80) || 'Ad chat';
      await updateChatSession(sessionId, companyId, { title });
      session.title = title;
    }
    if (hasCreativesReady(nextState)) {
      nextStep = 'campaignChoice';
      newMessages.push(
        await assistantMsg(
          sessionId,
          "Your creatives are already in — let's set up your campaign.",
          'campaignChoice',
        ),
      );
    } else {
      nextStep = 'mediaSource';
      newMessages.push(
        await assistantMsg(
          sessionId,
          "Sounds good — we'll get this live on Meta together. How do you want to bring in your creatives?",
          'mediaSource',
        ),
      );
    }
  } else if (step === 'campaignPreset' || step === 'adsetPreset' || step === 'campaignApprove' || step === 'adsetApprove') {
    const target =
      step === 'campaignPreset' || step === 'campaignApprove' ? 'campaign' : 'adset';
    const messages = [...(state.presetChatMessages ?? []), { role: 'user' as const, content: text }];
    nextState.presetChatMessages = messages;
    nextState.presetTarget = target;

    const draftCampaign =
      (nextState.draftCampaign as CampaignPreset | undefined) ?? defaultCampaignDraft();
    const draftAdset = (nextState.draftAdset as AdsetPreset | undefined) ?? defaultAdsetDraft();

    const turn = await runPresetChatTurn({
      target,
      userText: text,
      state: { ...nextState, presetChatMessages: state.presetChatMessages },
    });
    nextState.draftCampaign = turn.draftCampaign;
    nextState.draftAdset = turn.draftAdset;
    nextState.presetChatMessages = turn.presetChatMessages;
    nextState.adType = resolvePresetChatAdType(nextState.adType ?? null, turn.draftCampaign);
    nextState.tone = resolvePresetChatTone(nextState.tone ?? null);
    delete nextState.lastOperationError;

    const replyText = turn.reply;

    const approveHint =
      '\n\nIf this looks right, say **approve** or use the button below.';
    const previewCampaign = nextState.draftCampaign as CampaignPreset | undefined;
    const previewAdset = nextState.draftAdset as AdsetPreset | undefined;
    const am = await assistantMsg(sessionId, replyText + approveHint, 'presetPreview', {
      target,
      campaign: target === 'campaign' ? previewCampaign : previewCampaign ?? null,
      adset: target === 'adset' ? previewAdset : null,
    });
    newMessages.push(am);
    nextStep =
      step === 'campaignPreset' || step === 'campaignApprove'
        ? 'campaignApprove'
        : 'adsetApprove';
  } else if (step === 'preview') {
    nextStep = 'creativeBuild';
    const am = await assistantMsg(
      sessionId,
      "Got it — I'll adjust the copy. Regenerating creatives for your groups…",
      'creativeBuilding',
    );
    newMessages.push(am);
  } else {
    const am = await assistantMsg(
      sessionId,
      'Use the options in the card above to continue, or tell me what you want to change.',
    );
    newMessages.push(am);
  }

  await persistSession(session, nextStep, nextState);
  const refreshed = await getChatSession(sessionId, companyId);
  const serialized = serializeSession(refreshed!);
  return packageOrchestratorResult(serialized, nextStep, nextState, newMessages);
}

export async function handleChatAction(
  sessionId: string,
  companyId: string,
  action: ChatActionType,
  payload: Record<string, unknown>,
  userMessage?: string | null,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const state = parseWorkflowState(session.workflowState);
  const newMessages: SerializedMessage[] = [];
  let nextStep = session.currentStep as ChatWorkflowStep;
  let nextState = { ...state };
  let recoveredFromError = false;

  const displayUserText =
    userMessage?.trim() || resolveActionUserMessage(action, payload) || null;
  if (displayUserText && action !== 'creative.aiDone') {
    newMessages.push(await userMsg(sessionId, displayUserText));
  }

  switch (action) {
    case 'intent.ack': {
      if (hasCreativesReady(nextState)) {
        nextStep = 'campaignChoice';
        newMessages.push(
          await assistantMsg(
            sessionId,
            "Your creatives are already in — let's set up your campaign.",
            'campaignChoice',
          ),
        );
        break;
      }
      nextStep = 'mediaSource';
      newMessages.push(
        await assistantMsg(
          sessionId,
          "Let's build your ad. How would you like to add your creatives?",
          'mediaSource',
        ),
      );
      break;
    }

    case 'media.source': {
      if (hasCreativesReady(nextState)) {
        nextStep = 'campaignChoice';
        newMessages.push(
          await assistantMsg(
            sessionId,
            "Your creatives are already in — let's set up your campaign.",
            'campaignChoice',
          ),
        );
        break;
      }
      const source = payload.source as string;
      if (source === 'gallery') {
        nextStep = 'mediaPick';
        newMessages.push(
          await assistantMsg(sessionId, 'Pick a bulk folder or creatives from your gallery.', 'mediaPick'),
        );
      } else {
        nextStep = 'mediaUpload';
        newMessages.push(
          await assistantMsg(
            sessionId,
            "Drop your images and videos here. I'll group them once processing finishes.",
            'mediaUpload',
          ),
        );
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
      return handleChatAction(sessionId, companyId, 'media.analyzed', { bulkUploadId });
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
      await settleAnalyzingMessages(sessionId, { groupCount: groups.length });
      newMessages.push(
        await assistantMsg(
          sessionId,
          `Found **${groups.length}** creative group${groups.length === 1 ? '' : 's'}. Now let's set up your campaign.`,
          'campaignChoice',
        ),
      );
      await persistSession(session, nextStep, nextState, { bulkUploadId });
      break;
    }

    case 'campaign.choice': {
      const choice = payload.choice as string;
      if (choice === 'existing') {
        nextStep = 'campaignSelect';
        newMessages.push(
          await assistantMsg(sessionId, 'Choose an existing campaign:', 'campaignPicker', {
            mode: 'campaign',
          }),
        );
      } else {
        nextStep = 'pixelSetup';
        delete nextState.hasPixel;
        delete nextState.pixelId;
        delete nextState.trafficOptimizationGoal;
        newMessages.push(
          await assistantMsg(
            sessionId,
            'Before we build your campaign — **do you have a Meta Pixel ID?** Conversion campaigns (Sales, website Leads) need one. You can still run Traffic, Engagement, or Awareness without a pixel.',
            'pixelQuestion',
          ),
        );
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
      newMessages.push(
        await assistantMsg(sessionId, hint, 'campaignObjective', {
          hasPixel: nextState.hasPixel,
        }),
      );
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
        newMessages.push(
          await assistantMsg(
            sessionId,
            'That objective needs a Meta Pixel. Add your pixel ID above or pick Traffic, Engagement, or Awareness.',
            'campaignObjective',
            { hasPixel: nextState.hasPixel },
          ),
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
      newMessages.push(
        await assistantMsg(
          sessionId,
          `**${objective.replace(/^OUTCOME_/, '').replace(/_/g, ' ')}** selected${goalNote}. Tell me your budget, schedule, and any targeting preferences — I'll draft the campaign preset.`,
          'campaignPreset',
          { objective, hasPixel: nextState.hasPixel },
        ),
      );
      break;
    }

    case 'campaign.selected': {
      const campaignId = String(payload.campaignId ?? '');
      nextState.campaignId = campaignId;
      nextStep = 'adsetChoice';
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Campaign selected. Do you want an existing ad set or create a new one?',
          'adsetChoice',
          { campaignId },
        ),
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
        newMessages.push(
          await assistantMsg(
            sessionId,
            (result.reply ?? 'Please review the updated campaign preset.') + approveHint,
            'presetPreview',
            {
              target: 'campaign',
              campaign: nextState.draftCampaign,
              adset: null,
            },
          ),
        );
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
      newMessages.push(
        await assistantMsg(sessionId, intro, 'adsetChoice', { campaignId: result.created.id }),
      );
      await persistSession(session, nextStep, nextState, { campaignId: result.created.id });
      break;
    }

    case 'adset.choice': {
      const choice = payload.choice as string;
      if (choice === 'existing') {
        nextStep = 'adsetSelect';
        newMessages.push(
          await assistantMsg(sessionId, 'Choose an ad set for your ads:', 'adsetPicker', {
            campaignId: nextState.campaignId,
          }),
        );
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
        newMessages.push(
          await assistantMsg(
            sessionId,
            'Describe your ad set — budget, schedule, audience, and optimization. I will align it with your campaign settings.',
            'adsetPreset',
          ),
        );
      }
      break;
    }

    case 'workflow.goBack': {
      const targetStep = payload.step as ChatWorkflowStep | undefined;
      const current = session.currentStep as ChatWorkflowStep;

      if (!targetStep) {
        const options = getBackStepOptions(current, nextState);
        nextStep = current;
        newMessages.push(
          await assistantMsg(sessionId, 'Which step would you like to go back to?', 'stepNav', {
            options,
          }),
        );
        break;
      }

      if (!isAllowedBackStep(current, targetStep, nextState)) {
        newMessages.push(
          await assistantMsg(sessionId, "You can't jump to that step from here. Pick another option."),
        );
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

      newMessages.push(
        await assistantMsg(sessionId, content, widgetType ?? undefined, widgetPayload),
      );
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
      newMessages.push(
        await assistantMsg(
          sessionId,
          'How should we fill in ad copy for each creative group?',
          'creativeMode',
        ),
      );
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
        newMessages.push(
          await assistantMsg(
            sessionId,
            (result.reply ?? 'Please review the updated ad set preset.') + approveHint,
            'presetPreview',
            {
              target: 'adset',
              campaign: nextState.draftCampaign,
              adset: nextState.draftAdset,
            },
          ),
        );
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
      newMessages.push(await assistantMsg(sessionId, intro, 'creativeMode'));
      break;
    }

    case 'creative.mode': {
      const mode = payload.mode as 'ai' | 'csv';
      nextState.creativeMode = mode;
      if (mode === 'csv') {
        nextStep = 'creativeCsv';
        newMessages.push(
          await assistantMsg(
            sessionId,
            'Upload a CSV with columns: groupKey, headline, primaryText, landingUrl, ctaType (optional).',
            'creativeCsv',
          ),
        );
      } else {
        nextStep = 'creativeBuild';
        console.log('[chats:creative-ai] creative.mode → creativeBuild', {
          sessionId,
          groupCount: nextState.groups?.length ?? 0,
          included: nextState.groups?.filter((g) => g.included).length ?? 0,
        });
        newMessages.push(
          await assistantMsg(
            sessionId,
            'Generating ad copy for each group with AI…',
            'creativeBuilding',
          ),
        );
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
      newMessages.push(
        await assistantMsg(sessionId, 'Here is your ad preview. Approve or request changes.', 'adPreview', {
          groups: nextState.groups,
        }),
      );
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
      newMessages.push(
        await assistantMsg(sessionId, 'Here is your ad preview. Approve or request changes.', 'adPreview', {
          groups: nextState.groups,
        }),
      );
      break;
    }

    case 'preview.changes': {
      nextStep = 'creativeBuild';
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Tell me what to change, or use AI regenerate on the next card.',
          'creativeBuilding',
        ),
      );
      break;
    }

    case 'preview.approved': {
      nextStep = 'publishChoice';
      newMessages.push(
        await assistantMsg(
          sessionId,
          'Ready to publish. Post immediately or schedule for later?',
          'publishSchedule',
        ),
      );
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
      newMessages.push(
        await assistantMsg(
          sessionId,
          `Queued **${jobIds.length}** ad${jobIds.length === 1 ? '' : 's'} for publishing. View progress in Ad History.`,
          'done',
          { jobIds },
        ),
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
      newMessages.push(await assistantMsg(sessionId, 'Unknown action.'));
  }

  await persistSession(session, nextStep, nextState);
  const refreshed = await getChatSession(sessionId, companyId);
  const serialized = serializeSession(refreshed!);
  return packageOrchestratorResult(serialized, nextStep, nextState, newMessages, {
    recoveredFromError,
  });
}
