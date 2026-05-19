import 'server-only';

import type { CampaignPreset } from '@/app/components/manager/presets/types';
import { completeJsonChatWithHistory } from '@/lib/assistant/openai-json';
import { CHAT_AGENT_MODEL } from '@/lib/assistant/models';

import { buildAdAgentContextMessage, buildAdAgentSystemPrompt } from './agent-prompt';
import { type AgentPlan, agentPlanSchema } from './agent-schema';
import { normalizeAgentPlan, suggestAgentNextStep } from './agent-steps';
import { buildWorkflowProgress } from './workflow-manifest';
import type { ChatWorkflowStep, SerializedMessage, WorkflowState } from './types';

export type WorkflowProgressContext = {
  progress: ReturnType<typeof buildWorkflowProgress>;
  stateSummary: Record<string, unknown>;
  currentStep: ChatWorkflowStep;
};

export const AGENT_HISTORY_LIMIT = 10;

export function summarizeWorkflowStateForAgent(state: WorkflowState): Record<string, unknown> {
  const campaign = state.draftCampaign as CampaignPreset | undefined;
  const targeting = state.draftAdset?.targeting as Record<string, unknown> | undefined;
  return {
    hasPixel: state.hasPixel,
    pixelId: state.pixelId ? '(set)' : null,
    tone: state.tone,
    adType: state.adType ?? campaign?.objective,
    trafficOptimizationGoal: state.trafficOptimizationGoal,
    intentNotes: state.intentNotes,
    agentNextStep: state.agentNextStep,
    agentMemory: state.agentMemory,
    groupCount: state.groups?.length ?? 0,
    campaignId: state.campaignId,
    defaultAdSetId: state.defaultAdSetId,
    campaignName: campaign?.name,
    campaignObjective: campaign?.objective,
    campaignDailyBudget: campaign?.dailyBudget,
    campaignLifetimeBudget: campaign?.lifetimeBudget,
    adsetName: state.draftAdset?.name,
    adsetOptimizationGoal: state.draftAdset?.optimizationGoal,
    targetingSummary: targeting
      ? {
          countries: (targeting.geo_locations as { countries?: string[] })?.countries,
          age_min: targeting.age_min,
          age_max: targeting.age_max,
        }
      : null,
    creativeMode: state.creativeMode,
    lastOperationError: state.lastOperationError ? '(present)' : null,
  };
}

/** Last N user/assistant text messages for multi-turn memory (mandatory). */
export function buildAgentHistoryMessages(
  messages: SerializedMessage[],
  limit = AGENT_HISTORY_LIMIT,
): { role: 'user' | 'assistant'; content: string }[] {
  const textOnly = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content!.trim(),
    }));
  return textOnly.slice(-limit);
}

export async function runAdAgentTurn(input: {
  userText: string;
  state: WorkflowState;
  currentStep: ChatWorkflowStep;
  priorMessages: SerializedMessage[];
}): Promise<AgentPlan> {
  const progress = buildWorkflowProgress(input.state, input.currentStep);
  const ctx: WorkflowProgressContext = {
    progress,
    stateSummary: summarizeWorkflowStateForAgent(input.state),
    currentStep: input.currentStep,
  };

  const history = buildAgentHistoryMessages(input.priorMessages);
  const suggested = suggestAgentNextStep(input.state);
  const contextBlock = buildAdAgentContextMessage(ctx, suggested);

  const apiMessages: { role: 'user' | 'assistant'; content: string }[] = [
    ...history,
    {
      role: 'user',
      content: `${contextBlock}\n\n---\n\nUser message:\n${input.userText}`,
    },
  ];

  const raw = await completeJsonChatWithHistory({
    model: CHAT_AGENT_MODEL,
    system: buildAdAgentSystemPrompt(),
    messages: apiMessages,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const normalized = normalizeAgentPlan(parsed, input.state);
  const result = agentPlanSchema.safeParse(normalized);
  if (result.success) return result.data;
  return normalized;
}
