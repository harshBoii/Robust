import 'server-only';

import type { BountySpreadPlatform } from '@/app/generated/prisma/client';
import {
  appendChatMessages,
  getChatSession,
  updateChatSession,
  type DbChatSession,
} from '@/lib/chats/repository';
import { parseWorkflowState, serializeMessage, serializeSession } from '@/lib/chats/serialize';
import type { ChatActionType, OrchestratorResult, SerializedMessage, WorkflowState } from '@/lib/chats/types';

import type { GeoChatState } from './types';

const GEO_STEP = 'geo';

async function userMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'USER', content }]);
  return serializeMessage(row);
}

async function assistantMsg(sessionId: string, content: string): Promise<SerializedMessage> {
  const [row] = await appendChatMessages(sessionId, [{ role: 'ASSISTANT', content }]);
  return serializeMessage(row);
}

function formatRedditTargetLabel(name: string, kind: string): string {
  if (kind === 'profile') return `your Reddit profile (${name})`;
  const clean = name.replace(/^r\//i, '');
  return `r/${clean}`;
}

export async function handleGeoChatAction(
  sessionId: string,
  companyId: string,
  action: ChatActionType,
  payload: Record<string, unknown>,
  userMessage?: string | null,
): Promise<OrchestratorResult> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) throw new Error('Session not found');

  const workflow = parseWorkflowState(session.workflowState);
  let geo: GeoChatState = workflow.geo ?? {};
  const newMessages: SerializedMessage[] = [];

  if (action === 'geo.redditTargetPicked') {
    const subreddit =
      (typeof payload.subreddit === 'string' && payload.subreddit.trim()) ||
      (typeof payload.name === 'string' && payload.name.trim()) ||
      '';
    if (!subreddit) {
      throw new Error('subreddit is required');
    }

    const bountyId =
      (typeof payload.bountyId === 'string' && payload.bountyId.trim()) ||
      geo.pendingPublish?.bountyId ||
      geo.lastBountyId ||
      '';
    if (!bountyId) {
      throw new Error('bountyId is required');
    }

    const flairId =
      typeof payload.flairId === 'string' && payload.flairId.trim()
        ? payload.flairId.trim()
        : undefined;

    const kind = payload.kind === 'profile' ? 'profile' : 'subreddit';

    const display = formatRedditTargetLabel(subreddit, kind);

    if (userMessage?.trim()) {
      newMessages.push(await userMsg(sessionId, userMessage.trim()));
    }

    const platforms: BountySpreadPlatform[] = geo.pendingPublish?.platforms?.includes('REDDIT')
      ? geo.pendingPublish.platforms
      : ['REDDIT'];

    geo = {
      ...geo,
      lastBountyId: bountyId,
      pendingPublish: {
        bountyId,
        platforms,
        confirmed: false,
        redditSubreddit: subreddit,
        redditFlairId: flairId,
      },
      composerSuggestions: [
        'Yes, publish to Reddit now',
        'Publish LinkedIn and blog too',
        'Pick a different subreddit',
      ],
    };

    newMessages.push(
      await assistantMsg(
        sessionId,
        `Got it — I'll publish to **${display}**${flairId ? ' with your selected flair' : ''} when you confirm. Say **"yes, publish now"** to go live.`,
      ),
    );
  } else {
    throw new Error(`Unknown GEO action: ${action}`);
  }

  const nextWorkflow: WorkflowState = { ...workflow, geo };

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
