import 'server-only';

import { classifyWidgetChoice } from '@/lib/chats/classify-widget-choice';
import {
  appendChatMessages,
  getChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type {
  ChatActionType,
  ChatWorkflowStep,
  OrchestratorResult,
  SerializedMessage,
} from '@/lib/chats/types';
import {
  dispatchForImageGenChoice,
  imageGenStepDescription,
  optionsForImageGenStep,
} from '@/lib/image-gen/widget-choice-options';
import { parseImageGenState } from '@/lib/image-gen/state';

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function assistantMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'ASSISTANT', content }]);
  return serializeMessage(row);
}

function packageImageGenResult(
  session: DbChatSession,
  workflowState: ReturnType<typeof parseWorkflowState>,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  const serialized = serializeSession({ ...session, workflowState, currentStep: 'imageGen' });
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: 'imageGen',
      workflowState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
    operationError: workflowState.lastOperationError ?? null,
  };
}

export async function tryHandleImageGenWidgetChoiceTurn(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult | null> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) return null;

  const workflowState = parseWorkflowState(session.workflowState);
  const ig = parseImageGenState(workflowState);
  if (!ig) return null;

  const options = optionsForImageGenStep(ig);
  if (!options?.length) return null;

  const { matched, optionId } = await classifyWidgetChoice({
    userText: text,
    stepDescription: imageGenStepDescription(ig.step),
    options,
  });
  if (!matched || !optionId) return null;

  const dispatch = dispatchForImageGenChoice(ig.step, optionId);
  if (!dispatch) return null;

  if (dispatch.kind === 'upload_hint') {
    const userRow = await userMsg(sessionId, text);
    const hint =
      dispatch.role === 'model'
        ? 'Use **Upload your own** in the model gallery below to add your model photo.'
        : dispatch.role === 'background'
          ? 'Use **Upload your own** in the background gallery below.'
          : 'Use **Upload your own** in the pose gallery below.';
    const assistantRow = await assistantMsg(sessionId, hint);
    const updated = await getChatSession(sessionId, companyId);
    return packageImageGenResult(session, workflowState, [userRow, assistantRow]);
  }

  const { handleImageGenAction } = await import('@/lib/image-gen/orchestrator');
  return handleImageGenAction(
    sessionId,
    companyId,
    dispatch.action,
    dispatch.payload,
    text,
  );
}

export type AdsWidgetChoiceOption = {
  optionId: string;
  label: string;
};

function optionsForAdsStep(step: ChatWorkflowStep): AdsWidgetChoiceOption[] | null {
  switch (step) {
    case 'mediaSource':
      return [
        { optionId: 'upload', label: 'Upload here' },
        { optionId: 'gallery', label: 'From gallery' },
        { optionId: 'bulk', label: 'Bulk upload' },
      ];
    case 'campaignChoice':
      return [
        { optionId: 'existing', label: 'Existing campaign' },
        { optionId: 'new', label: 'Create new' },
      ];
    case 'adsetChoice':
      return [
        { optionId: 'existing', label: 'Existing ad set' },
        { optionId: 'new', label: 'Create new' },
      ];
    case 'creativeMode':
      return [
        { optionId: 'ai', label: 'AI copy' },
        { optionId: 'csv', label: 'Upload CSV' },
      ];
    default:
      return null;
  }
}

function adsStepDescription(step: ChatWorkflowStep): string {
  switch (step) {
    case 'mediaSource':
      return 'How to add creatives';
    case 'campaignChoice':
      return 'Existing or new campaign';
    case 'adsetChoice':
      return 'Existing or new ad set';
    case 'creativeMode':
      return 'AI copy or CSV upload';
    default:
      return step;
  }
}

function dispatchForAdsChoice(
  step: ChatWorkflowStep,
  optionId: string,
): { action: string; payload: Record<string, unknown> } | null {
  switch (step) {
    case 'mediaSource':
      if (optionId === 'upload' || optionId === 'gallery' || optionId === 'bulk') {
        return { action: 'media.source', payload: { source: optionId } };
      }
      return null;
    case 'campaignChoice':
      if (optionId === 'existing' || optionId === 'new') {
        return { action: 'campaign.choice', payload: { choice: optionId } };
      }
      return null;
    case 'adsetChoice':
      if (optionId === 'existing' || optionId === 'new') {
        return { action: 'adset.choice', payload: { choice: optionId } };
      }
      return null;
    case 'creativeMode':
      if (optionId === 'ai' || optionId === 'csv') {
        return { action: 'creative.mode', payload: { mode: optionId } };
      }
      return null;
    default:
      return null;
  }
}

export async function tryHandleAdsWidgetChoiceTurn(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult | null> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) return null;

  const step = session.currentStep as ChatWorkflowStep;
  const options = optionsForAdsStep(step);
  if (!options?.length) return null;

  const { matched, optionId } = await classifyWidgetChoice({
    userText: text,
    stepDescription: adsStepDescription(step),
    options,
  });
  if (!matched || !optionId) return null;

  const dispatch = dispatchForAdsChoice(step, optionId);
  if (!dispatch) return null;

  const { handleChatAction } = await import('./orchestrator');
  return handleChatAction(
    sessionId,
    companyId,
    dispatch.action as ChatActionType,
    dispatch.payload,
    text,
  );
}
