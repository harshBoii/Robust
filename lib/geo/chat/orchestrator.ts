import 'server-only';

import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';

import { runGeoAgentTurn } from './geo-agent-turn';
import type { GeoAgentTurn } from './geo-agent-schema';
import { parseSpreadPlatforms } from '@/lib/geo/bounty/spread-platforms';

import type { GeoChatState, GeoPendingPublish } from './types';
import { buildGeoBountyPreviewFromToolResults } from './build-preview-widget';
import { executeGeoTool } from './tools';

const GEO_STEP = 'geo';
const MAX_TOOL_ROUNDS = 3;

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function assistantMsg(
  sessionId: string,
  content: string,
  widget?: { type: string; payload: unknown },
): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [
    {
      role: 'ASSISTANT',
      content,
      widgetType: widget?.type ?? null,
      widgetPayload: widget?.payload ?? null,
    },
  ]);
  return serializeMessage(row);
}

function mergeGeoState(
  prev: GeoChatState,
  patch: Partial<GeoChatState>,
  turn?: GeoAgentTurn,
): GeoChatState {
  let next: GeoChatState = { ...prev, ...patch };

  if (turn?.memory) next.memory = turn.memory;

  if (turn?.suggestions?.length) {
    next.composerSuggestions = turn.suggestions;
  } else if (turn?.status === 'reply') {
    next.composerSuggestions = undefined;
  } else if ('composerSuggestions' in patch) {
    next.composerSuggestions = patch.composerSuggestions;
  }

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
    };
  }

  return next;
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
  let geo = workflow.geo ?? {};

  const newMessages: SerializedMessage[] = [];
  if (!options?.skipUserBubble) {
    newMessages.push(await userMsg(sessionId, text));
  }

  const priorMessages = [...(session.messages ?? []).map(serializeMessage), ...newMessages];

  const allToolResults: Array<{
    name: string;
    args?: Record<string, unknown>;
    result: { ok: boolean; data?: unknown; error?: string };
  }> = [];
  let toolResults: typeof allToolResults = [];

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
      // Empty tool turn after retries inside runGeoAgentTurn; one more reply-only attempt.
      turn = await runGeoAgentTurn({
        userText: text,
        geo,
        priorMessages,
        toolResults: allToolResults.length ? allToolResults : toolResults,
      });
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
      roundResults.push({ name: call.name, args: call.args, result });
    }
    allToolResults.push(...roundResults);
    toolResults = roundResults;
  }

  if (!turn || turn.status !== 'reply') {
    turn = {
      status: 'reply',
      reply:
        allToolResults.length > 0
          ? 'Here is what I found from your GEO data. Ask a follow-up if you want to go deeper on any prompt or bounty.'
          : 'How can I help with your GEO strategy today?',
    };
  }

  geo = mergeGeoState(geo, {}, turn);

  const previewPayload = buildGeoBountyPreviewFromToolResults(allToolResults);
  let reply =
    turn.reply?.trim() ||
    'Let me know what you would like to explore — share of voice, prompts, bounties, or publishing content.';

  if (previewPayload) {
    reply = stripInternalIdsFromGeoReply(reply);
    if (!/preview/i.test(reply)) {
      reply = `${reply}\n\nPlatform previews are below — switch tabs to review each draft before publishing.`;
    }
  }

  const assistantWidget = resolveGeoAssistantWidget(turn, geo, previewPayload);

  newMessages.push(await assistantMsg(sessionId, reply, assistantWidget));

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

function resolveGeoAssistantWidget(
  turn: GeoAgentTurn,
  geo: GeoChatState,
  previewPayload: ReturnType<typeof buildGeoBountyPreviewFromToolResults>,
): { type: string; payload: unknown } | undefined {
  if (turn.redditTargetPicker?.bountyId) {
    const pickerBountyId = turn.redditTargetPicker.bountyId;
    return {
      type: 'geoRedditTargetPicker',
      payload: {
        bountyId: pickerBountyId,
        initialSubreddit: geo.pendingPublish?.redditSubreddit ?? null,
      },
    };
  }

  if (previewPayload) {
    return { type: 'geoBountyPreviews', payload: previewPayload };
  }

  return undefined;
}


/** Remove raw bounty/content IDs from assistant text when previews are shown inline. */
function stripInternalIdsFromGeoReply(text: string): string {
  return text
    .replace(/^\s*[-*]?\s*\*?\*?Bounty ID\*?\*?:\s*\S+\s*$/gim, '')
    .replace(/^\s*[-*]?\s*\*?\*?(LinkedIn|Reddit|X|Website).*content ID\*?\*?:\s*\S+\s*$/gim, '')
    .replace(/^\s*[-*]?\s*\*?\*?Published draft assets created\*?\*?:\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
