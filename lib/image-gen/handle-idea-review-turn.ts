import 'server-only';

import type { DbChatSession } from '@/lib/chats/repository';
import type { OrchestratorResult, SerializedMessage } from '@/lib/chats/types';
import type { WorkflowState } from '@/lib/chats/types';

import { classifyIdeaReviewTurn } from './classify-idea-review-turn';
import { buildIdeaReviewWidgetPayload } from './idea-review-widget-payload';
import { mergeImageGenIntoWorkflow } from './state';
import type { ImageGenState } from './types';
import { regenerateVariantPrompts } from './variant-prompts';

export type IdeaReviewTurnDeps = {
  resolveProductImageUrl: (companyId: string, ig: ImageGenState) => Promise<string | null>;
  assistantMsg: (
    sessionId: string,
    content: string,
    widgetType?: string | null,
    widgetPayload?: unknown,
  ) => Promise<SerializedMessage>;
  runGenerateVariants: (
    session: DbChatSession,
    workflowState: WorkflowState,
    ig: ImageGenState,
    priorMessages: SerializedMessage[],
  ) => Promise<OrchestratorResult>;
  persist: (session: DbChatSession, workflowState: WorkflowState) => Promise<void>;
  getChatSession: (sessionId: string, companyId: string) => Promise<DbChatSession | null>;
  packageResult: (
    session: DbChatSession,
    workflowState: WorkflowState,
    newMessages: SerializedMessage[],
  ) => OrchestratorResult;
};

export async function handleIdeaReviewTurn(
  session: DbChatSession,
  companyId: string,
  workflowState: WorkflowState,
  ig: ImageGenState,
  userText: string,
  newMessages: SerializedMessage[],
  deps: IdeaReviewTurnDeps,
): Promise<OrchestratorResult> {
  const variants = ig.variants ?? [];
  const turn = await classifyIdeaReviewTurn({ userText, variants });

  if (turn.intent === 'accept_all') {
    return deps.runGenerateVariants(session, workflowState, ig, newMessages);
  }

  if (turn.intent === 'apply_changes' && turn.changes.length) {
    const refUrl = await deps.resolveProductImageUrl(session.companyId, ig);
    if (!refUrl) throw new Error('Product image missing');

    const updated = await regenerateVariantPrompts({
      state: ig,
      productImageUrl: refUrl,
      changes: turn.changes,
    });

    ig = { ...ig, variants: updated, step: 'reviewIdeas' };
    const nums = turn.changes.map((c) => c.index + 1).join(', ');
    newMessages.push(
      await deps.assistantMsg(
        session.id,
        `Updated prompt${turn.changes.length > 1 ? 's' : ''} ${nums}. Review below, edit again in chat, or say "accept all".`,
        'imageGenIdeaReview',
        buildIdeaReviewWidgetPayload(updated),
      ),
    );
    const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
    await deps.persist(session, nextWorkflow);
    const updatedSession = await deps.getChatSession(session.id, companyId);
    return deps.packageResult(updatedSession!, nextWorkflow, newMessages);
  }

  const unclearReply =
    turn.intent === 'unclear'
      ? turn.reply
      : 'Tell me which prompt to change (e.g. "change prompt 1 to …") or say "accept all".';

  newMessages.push(
    await deps.assistantMsg(
      session.id,
      unclearReply,
      'imageGenIdeaReview',
      buildIdeaReviewWidgetPayload(variants),
    ),
  );
  const nextWorkflow = mergeImageGenIntoWorkflow(workflowState, ig);
  await deps.persist(session, nextWorkflow);
  const updatedSession = await deps.getChatSession(session.id, companyId);
  return deps.packageResult(updatedSession!, nextWorkflow, newMessages);
}
