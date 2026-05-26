import 'server-only';

import { classifyWidgetChoice } from '@/lib/chats/classify-widget-choice';
import { getChatSession } from '@/lib/chats/repository';
import { parseWorkflowState } from '@/lib/chats/serialize';
import type { OrchestratorResult } from '@/lib/chats/types';

import { handleVideoGenAction } from './orchestrator';
import { parseVideoGenState } from './state';
import {
  dispatchForVideoGenChoice,
  optionsForVideoGenStep,
  videoGenStepDescription,
} from './widget-choice-options';

/** Route typed replies to the same handlers as widget clicks (image-gen pattern). */
export async function tryHandleVideoGenWidgetChoiceTurn(
  sessionId: string,
  companyId: string,
  text: string,
): Promise<OrchestratorResult | null> {
  const session = await getChatSession(sessionId, companyId);
  if (!session) return null;

  const workflowState = parseWorkflowState(session.workflowState);
  const vg = parseVideoGenState(workflowState);
  if (!vg) return null;

  const options = optionsForVideoGenStep(vg);
  if (!options?.length) return null;

  const { matched, optionId } = await classifyWidgetChoice({
    userText: text,
    stepDescription: videoGenStepDescription(vg.step),
    options,
  });
  if (!matched || !optionId) return null;

  const dispatch = dispatchForVideoGenChoice(vg.step, optionId);
  if (!dispatch) return null;

  return handleVideoGenAction(
    sessionId,
    companyId,
    dispatch.action,
    dispatch.payload,
    text,
  );
}
