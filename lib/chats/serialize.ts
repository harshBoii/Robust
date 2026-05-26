import { sanitizeWorkflowStateForClient } from '@/lib/video-gen/state';

import type { DbChatMessage, DbChatSession } from './repository';
import type { SerializedMessage, WorkflowState } from './types';

export function parseWorkflowState(raw: unknown): WorkflowState {
  if (!raw || typeof raw !== 'object') return {};
  return raw as WorkflowState;
}

export function serializeMessage(m: DbChatMessage): SerializedMessage {
  return {
    id: m.id,
    role: m.role === 'USER' ? 'user' : m.role === 'ASSISTANT' ? 'assistant' : 'system',
    content: m.content,
    widgetType: m.widgetType,
    widgetPayload: m.widgetPayload,
    createdAt: m.createdAt.toISOString(),
  };
}

export function serializeSession(session: DbChatSession) {
  const workflowState = sanitizeWorkflowStateForClient(
    parseWorkflowState(session.workflowState),
  );
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    currentStep: session.currentStep,
    workflowState,
    bulkUploadId: session.bulkUploadId,
    campaignId: session.campaignId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: (session.messages ?? []).map(serializeMessage),
  };
}
