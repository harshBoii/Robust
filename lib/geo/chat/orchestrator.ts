import 'server-only';

import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';

import { userConfirmedPublish } from './confirm-publish';
import { runGeoAgentTurn } from './geo-agent-turn';
import type { GeoAgentTurn } from './geo-agent-schema';
import { parseSpreadPlatforms } from '@/lib/geo/bounty/spread-platforms';

import type { GeoChatState, GeoPendingPublish } from './types';
import { executeGeoTool } from './tools';

const GEO_STEP = 'geo';
const MAX_TOOL_ROUNDS = 3;

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function assistantMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'ASSISTANT', content }]);
  return serializeMessage(row);
}

function mergeGeoState(
  prev: GeoChatState,
  patch: Partial<GeoChatState>,
  turn?: GeoAgentTurn,
): GeoChatState {
  let next: GeoChatState = { ...prev, ...patch };

  if (turn?.memory) next.memory = turn.memory;

  if ('pendingPublish' in patch) {
    next.pendingPublish = patch.pendingPublish;
  } else if (turn?.pendingPublish) {
    const platforms = turn.pendingPublish.platforms
      ? parseSpreadPlatforms(turn.pendingPublish.platforms)
      : undefined;
    next.pendingPublish = {
      bountyId: turn.pendingPublish.bountyId,
      platforms: platforms?.length ? platforms : undefined,
      contentId: turn.pendingPublish.contentId,
      approveAll: turn.pendingPublish.approveAll,
      redditSubreddit: turn.pendingPublish.redditSubreddit,
      redditFlairId: turn.pendingPublish.redditFlairId,
      confirmed: turn.pendingPublish.confirmed ?? false,
    };
  }

  return next;
}

function applyPublishConfirmation(geo: GeoChatState, userText: string): GeoChatState {
  if (!geo.pendingPublish || geo.pendingPublish.confirmed) return geo;
  if (!userConfirmedPublish(userText)) return geo;
  return {
    ...geo,
    pendingPublish: { ...geo.pendingPublish, confirmed: true },
  };
}

export async function handleGeoMessage(
  sessionId: string,
  companyId: string,
  text: string,
  options?: { skipUserBubble?: boolean },
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const workflow = parseWorkflowState(session.workflowState);
  let geo = applyPublishConfirmation(workflow.geo ?? {}, text);

  const newMessages: SerializedMessage[] = [];
  if (!options?.skipUserBubble) {
    newMessages.push(await userMsg(sessionId, text));
  }

  const priorMessages = [...(session.messages ?? []).map(serializeMessage), ...newMessages];

  let toolResults: Array<{
    name: string;
    result: { ok: boolean; data?: unknown; error?: string };
  }> = [];

  let turn: GeoAgentTurn | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    turn = await runGeoAgentTurn({
      userText: text,
      geo,
      priorMessages,
      toolResults: toolResults.length ? toolResults : undefined,
    });

    if (turn.status === 'reply') break;

    const calls = turn.toolCalls ?? [];
    if (calls.length === 0) {
      turn = {
        status: 'reply',
        reply: 'I need a moment — what would you like to know about your organic visibility?',
      };
      break;
    }

    const roundResults: typeof toolResults = [];
    for (const call of calls) {
      const { result, statePatch } = await executeGeoTool(call, {
        companyId,
        sessionId,
        geo,
      });
      geo = mergeGeoState(geo, statePatch, turn);
      roundResults.push({ name: call.name, result });
    }
    toolResults = roundResults;
  }

  if (!turn || turn.status !== 'reply') {
    turn = {
      status: 'reply',
      reply:
        toolResults.length > 0
          ? 'Here is what I found from your GEO data. Ask a follow-up if you want to go deeper on any prompt or bounty.'
          : 'How can I help with your GEO strategy today?',
    };
  }

  geo = mergeGeoState(geo, {}, turn);

  const reply =
    turn.reply?.trim() ||
    'Let me know what you would like to explore — share of voice, prompts, bounties, or publishing content.';

  newMessages.push(await assistantMsg(sessionId, reply));

  const nextWorkflow: WorkflowState = {
    ...workflow,
    geo,
  };

  await updateChatSession(sessionId, companyId, {
    currentStep: GEO_STEP,
    pathType: 'GEO',
    workflowState: nextWorkflow,
  });

  const refreshed = await getChatSession(sessionId, companyId);
  if (!refreshed) throw new Error('Session not found');

  const serialized = serializeSession(refreshed as DbChatSession);
  return {
    session: {
      id: serialized.id,
      title: serialized.title,
      status: serialized.status,
      currentStep: GEO_STEP,
      workflowState: nextWorkflow,
      bulkUploadId: serialized.bulkUploadId,
      campaignId: serialized.campaignId,
    },
    messages: serialized.messages,
    newMessages,
  };
}

export async function initGeoFromFirstMessage(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult> {
  await updateChatSession(sessionId, companyId, {
    pathType: 'GEO',
    currentStep: GEO_STEP,
  });
  return handleGeoMessage(sessionId, companyId, text, { skipUserBubble: true });
}
