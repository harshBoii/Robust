import 'server-only';

import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';
import { resolvePresetChatAdType, resolvePresetChatTone } from '@/lib/assistant/preset-chat-prompt';

import {
  AGENT_ONLY_ACTIONS,
  SILENT_AGENT_CHAIN_ACTIONS,
} from './action-catalog';
import {
  type AgentAction,
  type AgentPlan,
  agentPlanSchema,
  statePatchPayloadSchema,
} from './agent-schema';
import { appendChatMessages, getChatSession, updateChatSession } from './repository';
import { runPresetChatTurn } from './preset-chat-turn';
import { parseWorkflowState, serializeMessage, serializeSession } from './serialize';
import { suggestFocusStep } from './workflow-manifest';
import type {
  ChatActionType,
  ChatWorkflowStep,
  OrchestratorResult,
  SerializedMessage,
  WidgetType,
  WorkflowState,
} from './types';

type PresetBuildAction = AgentAction & {
  action: 'preset.build';
  payload?: { target?: string; instruction?: string };
};

function campaignDraftHasObjective(state: WorkflowState): boolean {
  const d = state.draftCampaign as CampaignPreset | undefined;
  return Boolean(d?.objective);
}

/** Campaign before adset; reject adset-only without campaign objective draft. */
export function normalizePresetBuildOrder(
  actions: AgentAction[],
  state: WorkflowState,
): { actions: AgentAction[]; rejectReason: string | null } {
  const expanded: AgentAction[] = [];
  let rejectReason: string | null = null;

  for (const a of actions) {
    if (a.action !== 'preset.build') {
      expanded.push(a);
      continue;
    }
    const target = (a.payload?.target as string) ?? 'campaign';
    const instruction = String(a.payload?.instruction ?? '');

    if (target === 'both') {
      expanded.push({
        action: 'preset.build',
        payload: { target: 'campaign', instruction },
      });
      expanded.push({
        action: 'preset.build',
        payload: { target: 'adset', instruction },
      });
      continue;
    }

    if (target === 'adset' && !campaignDraftHasObjective(state)) {
      rejectReason =
        'Cannot build ad set preset before campaign draft has an objective. Run preset.build for campaign first.';
      console.warn('[chats:agent] preset.build adset rejected:', rejectReason);
      continue;
    }

    expanded.push(a);
  }

  const presetIndices = expanded
    .map((a, i) => (a.action === 'preset.build' ? i : -1))
    .filter((i) => i >= 0);
  if (presetIndices.length >= 2) {
    const campaignIdx = expanded.findIndex(
      (a) => a.action === 'preset.build' && a.payload?.target === 'campaign',
    );
    const adsetIdx = expanded.findIndex(
      (a) => a.action === 'preset.build' && a.payload?.target === 'adset',
    );
    if (campaignIdx >= 0 && adsetIdx >= 0 && adsetIdx < campaignIdx) {
      const campaignAction = expanded[campaignIdx];
      const adsetAction = expanded[adsetIdx];
      const reordered = expanded.filter((_, i) => i !== campaignIdx && i !== adsetIdx);
      const insertAt = Math.min(campaignIdx, adsetIdx);
      reordered.splice(insertAt, 0, campaignAction, adsetAction);
      return { actions: reordered, rejectReason };
    }
  }

  return { actions: expanded, rejectReason };
}

async function appendAssistant(
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

async function runPresetBuildAction(
  sessionId: string,
  companyId: string,
  instruction: string,
  target: 'campaign' | 'adset',
  state: WorkflowState,
): Promise<{
  state: WorkflowState;
  step: ChatWorkflowStep;
  message: SerializedMessage;
}> {
  const turn = await runPresetChatTurn({
    target,
    userText: instruction,
    state,
    priorMessages: state.presetChatMessages,
  });

  const nextState: WorkflowState = {
    ...state,
    draftCampaign: turn.draftCampaign,
    draftAdset: turn.draftAdset,
    presetChatMessages: turn.presetChatMessages,
    presetTarget: target,
    adType: resolvePresetChatAdType(state.adType ?? null, turn.draftCampaign),
    tone: resolvePresetChatTone(state.tone ?? null),
  };
  delete nextState.lastOperationError;

  const previewCampaign = nextState.draftCampaign as CampaignPreset | undefined;
  const previewAdset = nextState.draftAdset as AdsetPreset | undefined;
  const nextStep: ChatWorkflowStep =
    target === 'campaign' ? 'campaignApprove' : 'adsetApprove';

  const approveHint = '\n\nIf this looks right, use **Approve** or say you want to create on Meta.';
  const message = await appendAssistant(
    sessionId,
    turn.reply + approveHint,
    'presetPreview',
    {
      target,
      campaign: target === 'campaign' ? previewCampaign : previewCampaign ?? null,
      adset: target === 'adset' ? previewAdset : null,
    },
  );

  await updateChatSession(sessionId, companyId, {
    currentStep: nextStep,
    workflowState: nextState,
  });

  return { state: nextState, step: nextStep, message };
}

function isChatActionType(action: string): action is ChatActionType {
  const known: ChatActionType[] = [
    'intent.ack',
    'media.source',
    'media.uploaded',
    'media.analyzed',
    'media.galleryPicked',
    'campaign.choice',
    'pixel.answered',
    'campaign.objectivePicked',
    'campaign.selected',
    'campaign.presetUpdated',
    'campaign.approved',
    'adset.choice',
    'adset.selected',
    'adset.presetUpdated',
    'adset.approved',
    'creative.mode',
    'creative.csvParsed',
    'creative.aiDone',
    'preview.approved',
    'preview.changes',
    'publish.submit',
    'workflow.goBack',
  ];
  return known.includes(action as ChatActionType);
}

export async function executeAgentPlan(input: {
  sessionId: string;
  companyId: string;
  plan: AgentPlan;
  userRow: SerializedMessage;
}): Promise<OrchestratorResult> {
  const parsed = agentPlanSchema.safeParse(input.plan);
  const plan = parsed.success ? parsed.data : input.plan;

  let session = await getChatSession(input.sessionId, input.companyId);
  if (!session) throw new Error('Session not found');

  let state = parseWorkflowState(session.workflowState);
  let step = session.currentStep as ChatWorkflowStep;
  const newMessages: SerializedMessage[] = [input.userRow];
  let widgetEmitted = false;
  const actionErrors: string[] = [];

  const { actions: normalizedActions, rejectReason } = normalizePresetBuildOrder(
    plan.actions ?? [],
    state,
  );
  if (rejectReason) actionErrors.push(rejectReason);

  for (const item of normalizedActions) {
    if (SILENT_AGENT_CHAIN_ACTIONS.has(item.action)) continue;

    if (item.action === 'state.patch') {
      const patchResult = statePatchPayloadSchema.safeParse(item.payload ?? {});
      if (!patchResult.success) {
        actionErrors.push('Invalid state.patch payload');
        continue;
      }
      const patch = patchResult.data;
      state = { ...state, ...patch };
      await updateChatSession(input.sessionId, input.companyId, { workflowState: state });
      continue;
    }

    if (item.action === 'preset.build') {
      const target = (item.payload?.target as 'campaign' | 'adset') ?? 'campaign';
      const instruction = String(item.payload?.instruction ?? plan.reply);
      try {
        const built = await runPresetBuildAction(
          input.sessionId,
          input.companyId,
          instruction,
          target,
          state,
        );
        state = built.state;
        step = built.step;
        newMessages.push(built.message);
        widgetEmitted = true;
        session = (await getChatSession(input.sessionId, input.companyId))!;
      } catch (err) {
        console.error('[chats:agent] preset.build failed:', err);
        actionErrors.push(`preset.build (${target}) failed`);
      }
      continue;
    }

    if (AGENT_ONLY_ACTIONS.has(item.action)) {
      actionErrors.push(`Unknown agent action: ${item.action}`);
      continue;
    }

    if (!isChatActionType(item.action)) {
      actionErrors.push(`Unknown action: ${item.action}`);
      continue;
    }

    const { handleChatAction } = await import('./orchestrator');
    const actionResult = await handleChatAction(
      input.sessionId,
      input.companyId,
      item.action,
      (item.payload ?? {}) as Record<string, unknown>,
    );

    newMessages.push(...actionResult.newMessages);
    state = actionResult.session.workflowState;
    step = actionResult.session.currentStep;

    if (actionResult.newMessages.some((m) => m.widgetType)) {
      widgetEmitted = true;
    }

    session = (await getChatSession(input.sessionId, input.companyId))!;
  }

  const focusStep = plan.focusStep ?? suggestFocusStep(state);
  step = focusStep;

  let replyText = plan.reply;
  if (actionErrors.length > 0) {
    replyText = `${plan.reply}\n\n_(Note: ${actionErrors.join(' ')})_`;
  }

  if (!widgetEmitted) {
    const widgetType = plan.widget?.type as WidgetType | undefined;
    if (widgetType) {
      const finalMsg = await appendAssistant(
        input.sessionId,
        replyText,
        widgetType,
        plan.widget?.payload,
      );
      newMessages.push(finalMsg);
      widgetEmitted = true;
    } else {
      const finalMsg = await appendAssistant(input.sessionId, replyText);
      newMessages.push(finalMsg);
    }
  } else {
    const finalMsg = await appendAssistant(input.sessionId, replyText);
    newMessages.push(finalMsg);
  }

  await updateChatSession(input.sessionId, input.companyId, {
    currentStep: step,
    workflowState: state,
  });

  const refreshed = await getChatSession(input.sessionId, input.companyId);
  const serialized = serializeSession(refreshed!);

  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: step,
      workflowState: state,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
    operationError: state.lastOperationError ?? null,
    statusTone: state.lastOperationError ? 'fixing' : undefined,
  };
}
