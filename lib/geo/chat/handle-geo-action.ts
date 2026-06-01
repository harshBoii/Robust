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
import { handleGeoMessage } from './orchestrator';

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
        redditSubreddit: subreddit,
        redditFlairId: flairId,
      },
      composerSuggestions: [
        'Publish to Reddit now',
        'Publish all drafts for this bounty',
        'Pick a different subreddit',
      ],
    };

    newMessages.push(
      await assistantMsg(
        sessionId,
        `Saved **${display}**${flairId ? ' with your selected flair' : ''} for Reddit. Publishing that draft now…`,
      ),
    );

    const nextWorkflow: WorkflowState = { ...workflow, geo };
    await updateChatSession(sessionId, companyId, {
      currentStep: GEO_STEP,
      pathType: 'GEO',
      workflowState: nextWorkflow,
    });

    const publishTurn = await handleGeoMessage(
      sessionId,
      companyId,
      'Publish the Reddit draft for this bounty using the subreddit I just selected.',
      { skipUserBubble: true },
    );

    return {
      ...publishTurn,
      newMessages: [...newMessages, ...publishTurn.newMessages],
    };
  }

  throw new Error(`Unknown GEO action: ${action}`);
}
