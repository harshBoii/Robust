import 'server-only';

import {
  detectImageGenEmptyPicker,
  classifyEmptyPickerIntent,
  isShopifyProductPickerEmpty,
  pickImageGenBackStep,
  resolveAdsEmptyPicker,
  type EmptyPickerAlternative,
} from '@/lib/chats/empty-picker-intent';
import { getBackStepOptions, isAllowedBackStep } from '@/lib/chats/workflow-navigation';
import { parseImageGenState, mergeImageGenIntoWorkflow } from '@/lib/image-gen/state';
import type { ImageGenStep } from '@/lib/image-gen/types';
import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type {
  ChatWorkflowStep,
  OrchestratorResult,
  SerializedMessage,
  WorkflowState,
} from '@/lib/chats/types';

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function assistantMsg(
  sessionId: string,
  content: string,
  widgetType?: string | null,
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

function packageAdsResult(
  session: DbChatSession,
  workflowState: WorkflowState,
  step: ChatWorkflowStep,
  newMessages: SerializedMessage[],
): OrchestratorResult {
  const serialized = serializeSession({ ...session, workflowState, currentStep: step });
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: step,
      workflowState,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
    operationError: workflowState.lastOperationError ?? null,
  };
}

function widgetForImageGenStep(
  step: ImageGenStep,
  subpath: string,
): { type: string; payload?: Record<string, unknown> } {
  if (step === 'productSource') {
    return { type: 'imageGenSourceChoice', payload: { mode: 'productOnModel' } };
  }
  if (step === 'imageSource') {
    return { type: 'imageGenSourceChoice' };
  }
  if (step === 'variantImageSource') {
    return { type: 'imageGenVariantSource' };
  }
  if (step === 'customUpload') {
    return { type: 'imageGenUpload' };
  }
  return { type: 'imageGenSourceChoice', payload: { mode: subpath } };
}

/** When a picker has no rows, interpret free text for go-back vs alternate path. */
export async function tryHandleAdsEmptyPickerTurn(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult | null> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) return null;

  const step = session.currentStep as ChatWorkflowStep;
  const state = parseWorkflowState(session.workflowState);
  const detected = await resolveAdsEmptyPicker(companyId, step, state);
  if (!detected?.empty) return null;

  const backOptions = getBackStepOptions(step, state);
  const alternatives = allowedAlternativesForKind(detected.kind);
  const decision = await classifyEmptyPickerIntent({
    userText: text,
    kind: detected.kind,
    backOptions,
    alternatives,
  });

  if (
    decision.intent === 'go_back' &&
    decision.targetStep &&
    isAllowedBackStep(step, decision.targetStep as ChatWorkflowStep, state)
  ) {
    const { handleChatAction } = await import('./orchestrator');
    return handleChatAction(
      sessionId,
      companyId,
      'workflow.goBack',
      { step: decision.targetStep, label: backOptions.find((o) => o.step === decision.targetStep)?.label },
      text,
    );
  }

  if (decision.intent === 'use_alternative' && decision.alternative) {
    const { handleChatAction } = await import('./orchestrator');
    const action = alternativeToAction(decision.alternative);
    if (action) {
      return handleChatAction(sessionId, companyId, action.type, action.payload, text);
    }
  }

  const userRow = await userMsg(sessionId, text);
  const newMessages: SerializedMessage[] = [userRow];
  const hint = stayHint(detected.kind, backOptions, alternatives);
  newMessages.push(await assistantMsg(sessionId, hint, staleWidgetForStep(step, state)));
  await updateChatSession(sessionId, companyId, { workflowState: state, currentStep: step });
  const updated = await getChatSession(sessionId, companyId);
  return packageAdsResult(updated!, state, step, newMessages);
}

export async function tryHandleImageGenEmptyPickerTurn(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult | null> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) return null;

  const workflowState = parseWorkflowState(session.workflowState);
  const ig = parseImageGenState(workflowState);
  if (!ig) return null;

  const kind = detectImageGenEmptyPicker(ig);
  if (kind !== 'shopifyProducts') return null;
  if (!(await isShopifyProductPickerEmpty(companyId))) return null;

  const backOpts = [
    {
      step: 'imageGen' as ChatWorkflowStep,
      label:
        ig.subpath === 'productOnModel'
          ? 'Product source'
          : ig.subpath === 'productAd'
            ? 'Image source'
            : 'Variant image source',
    },
  ];

  const decision = await classifyEmptyPickerIntent({
    userText: text,
    kind: 'shopifyProducts',
    backOptions: backOpts,
    alternatives: ['custom_upload'],
  });

  const userRow = await userMsg(sessionId, text);
  const newMessages: SerializedMessage[] = [userRow];

  if (decision.intent === 'go_back') {
    const resetStep = pickImageGenBackStep(ig, text);
    if (resetStep) {
      ig.step = resetStep;
      const w = widgetForImageGenStep(resetStep, ig.subpath);
      const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
      await updateChatSession(sessionId, companyId, {
        currentStep: 'imageGen',
        workflowState: nextWorkflow,
        pathType: 'IMAGE_GEN',
      });
      newMessages.push(
        await assistantMsg(sessionId, `No problem — back to **${backOpts[0].label}**.`, w.type, w.payload),
      );
      const updated = await getChatSession(sessionId, companyId);
      const serialized = serializeSession(updated!);
      return {
        session: {
          id: serialized.id,
          title: serialized.title,
          status: serialized.status,
          currentStep: 'imageGen',
          workflowState: nextWorkflow,
          bulkUploadId: serialized.bulkUploadId,
          campaignId: serialized.campaignId,
        },
        messages: serialized.messages,
        newMessages,
        operationError: null,
      };
    }
  }

  if (decision.intent === 'use_alternative' || /upload|custom|file/.test(text.toLowerCase())) {
    ig.step = 'customUpload';
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await updateChatSession(sessionId, companyId, {
      currentStep: 'imageGen',
      workflowState: nextWorkflow,
      pathType: 'IMAGE_GEN',
    });
    newMessages.push(
      await assistantMsg(sessionId, 'No Shopify products synced — upload your product image instead.', 'imageGenUpload'),
    );
    const updated = await getChatSession(sessionId, companyId);
    const serialized = serializeSession(updated!);
    return {
      session: {
        id: serialized.id,
        title: serialized.title,
        status: serialized.status,
        currentStep: 'imageGen',
        workflowState: nextWorkflow,
        bulkUploadId: serialized.bulkUploadId,
        campaignId: serialized.campaignId,
      },
      messages: serialized.messages,
      newMessages,
      operationError: null,
    };
  }

  newMessages.push(
    await assistantMsg(
      sessionId,
      'No Shopify products are synced yet. Say **go back** to pick another source, or **upload** a product image.',
      'shopifyProductPicker',
    ),
  );
  const updated = await getChatSession(sessionId, companyId);
  const serialized = serializeSession(updated!);
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
    operationError: null,
  };
}

function allowedAlternativesForKind(
  kind: 'adset' | 'campaign' | 'gallery' | 'shopifyProducts',
): EmptyPickerAlternative[] {
  switch (kind) {
    case 'adset':
      return ['create_new_adset'];
    case 'campaign':
      return ['create_new_campaign'];
    case 'gallery':
      return ['upload_creatives'];
    case 'shopifyProducts':
      return ['custom_upload'];
  }
}

function alternativeToAction(alt: EmptyPickerAlternative): {
  type: import('./types').ChatActionType;
  payload: Record<string, unknown>;
} | null {
  switch (alt) {
    case 'create_new_adset':
      return { type: 'adset.choice', payload: { choice: 'new' } };
    case 'create_new_campaign':
      return { type: 'campaign.choice', payload: { choice: 'new' } };
    case 'upload_creatives':
      return { type: 'media.source', payload: { source: 'upload' } };
    case 'gallery_pick':
      return { type: 'media.source', payload: { source: 'gallery' } };
    case 'custom_upload':
      return { type: 'imageGen.source', payload: { source: 'custom' } };
    default:
      return null;
  }
}

function stayHint(
  kind: 'adset' | 'campaign' | 'gallery' | 'shopifyProducts',
  backOptions: { label: string }[],
  alternatives: EmptyPickerAlternative[],
): string {
  const back = backOptions.map((o) => `**${o.label}**`).join(' or ');
  const alt =
    kind === 'adset'
      ? '**Create new** ad set from preset'
      : kind === 'campaign'
        ? '**Create new** campaign'
        : kind === 'gallery'
          ? '**Upload** creatives here'
          : '**Upload** a custom image';
  return [
    "Nothing's available to pick in this list yet.",
    back ? `Say you want to go back (e.g. ${back}) and I'll take you there.` : '',
    `Or say you want to ${alt} instead.`,
  ]
    .filter(Boolean)
    .join(' ');
}

function staleWidgetForStep(
  step: ChatWorkflowStep,
  state: WorkflowState,
): string | null {
  switch (step) {
    case 'adsetSelect':
      return 'adsetPicker';
    case 'campaignSelect':
      return 'campaignPicker';
    case 'mediaPick':
      return 'mediaPick';
    default:
      return null;
  }
}
