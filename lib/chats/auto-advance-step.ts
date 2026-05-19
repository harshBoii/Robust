import 'server-only';

import type { AgentAction } from './agent-schema';
import type { AgentActionableStep } from './agent-steps';
import type { ChatActionType, WorkflowState } from './types';

export type ConfidentAutoAction = {
  action: ChatActionType;
  payload: Record<string, unknown>;
  reason: string;
};

function planHasAction(actions: AgentAction[], name: string): boolean {
  return actions.some((a) => a.action === name);
}

/** Media source from typed text — runs even if the model picked the wrong nextStep. */
export function inferMediaSourceAutoAction(
  state: WorkflowState,
  userText: string,
  actionsInPlan: AgentAction[],
): ConfidentAutoAction | null {
  if (state.groups?.length || state.bulkUploadId) return null;
  if (planHasAction(actionsInPlan, 'media.source')) return null;

  const t = userText.trim().toLowerCase();
  if (!t) return null;

  if (
    /pick from gallery|from gallery|use gallery|gallery|existing assets|existing creatives/.test(t)
  ) {
    return {
      action: 'media.source',
      payload: { source: 'gallery' },
      reason: 'User chose gallery (typed)',
    };
  }
  if (/upload here|^upload$|drop (files|images)|from my computer|upload images|upload videos/.test(t)) {
    return { action: 'media.source', payload: { source: 'upload' }, reason: 'User chose upload' };
  }
  if (/bulk upload|^bulk$/.test(t)) {
    return { action: 'media.source', payload: { source: 'bulk' }, reason: 'User chose bulk' };
  }
  return null;
}

/**
 * When the user message (or state) makes the next step obvious, run exactly ONE
 * workflow action on their behalf before showing the reply widget.
 */
export function inferConfidentAutoAction(input: {
  nextStep: AgentActionableStep;
  state: WorkflowState;
  userText: string;
  actionsInPlan: AgentAction[];
}): ConfidentAutoAction | null {
  const { state, actionsInPlan } = input;
  const t = input.userText.trim().toLowerCase();
  if (!t) return null;

  if (
    !state.creativeMode &&
    (input.nextStep === 'choose_creative_mode' || input.nextStep === 'analyze_ads') &&
    !planHasAction(actionsInPlan, 'creative.mode')
  ) {
    if (
      /write copy with ai|ai copy|generate.*copy|use ai|with ai|fill.*ai|copy with ai/.test(t) ||
      t === 'ai'
    ) {
      return {
        action: 'creative.mode',
        payload: { mode: 'ai' },
        reason: 'User chose AI ad copy',
      };
    }
    if (/upload csv|csv|spreadsheet|i have a csv/.test(t)) {
      return {
        action: 'creative.mode',
        payload: { mode: 'csv' },
        reason: 'User chose CSV ad copy',
      };
    }
  }

  const mediaAuto = inferMediaSourceAutoAction(state, input.userText, actionsInPlan);
  if (mediaAuto) return mediaAuto;

  if (input.nextStep === 'setup_campaign' && !planHasAction(actionsInPlan, 'campaign.choice')) {
    if (/^existing$|existing campaign|use existing|current campaign/.test(t)) {
      return {
        action: 'campaign.choice',
        payload: { choice: 'existing' },
        reason: 'User chose existing campaign',
      };
    }
    if (/^new$|new campaign|create (a )?new|from scratch/.test(t)) {
      return {
        action: 'campaign.choice',
        payload: { choice: 'new' },
        reason: 'User chose new campaign',
      };
    }
  }

  if (
    input.nextStep === 'choose_adset' &&
    !state.defaultAdSetId &&
    !planHasAction(actionsInPlan, 'adset.choice')
  ) {
    if (/^existing$|existing ad set|use existing/.test(t)) {
      return {
        action: 'adset.choice',
        payload: { choice: 'existing' },
        reason: 'User chose existing ad set',
      };
    }
    if (/new ad set|create (a )?new|from scratch/.test(t)) {
      return {
        action: 'adset.choice',
        payload: { choice: 'new' },
        reason: 'User chose new ad set',
      };
    }
  }

  if (
    input.nextStep === 'pick_objective' &&
    state.adType &&
    !planHasAction(actionsInPlan, 'campaign.objectivePicked')
  ) {
    return {
      action: 'campaign.objectivePicked',
      payload: {
        objective: state.adType,
        ...(state.trafficOptimizationGoal
          ? { trafficOptimizationGoal: state.trafficOptimizationGoal }
          : {}),
      },
      reason: 'Objective already captured in state',
    };
  }

  if (
    input.nextStep === 'confirm_pixel' &&
    !planHasAction(actionsInPlan, 'pixel.answered')
  ) {
    if (/no pixel|don't have|do not have|without pixel/.test(t)) {
      return {
        action: 'pixel.answered',
        payload: { hasPixel: false },
        reason: 'User confirmed no pixel',
      };
    }
    if (/yes.*pixel|have a pixel|pixel id|i have pixel/.test(t)) {
      return {
        action: 'pixel.answered',
        payload: { hasPixel: true },
        reason: 'User confirmed pixel',
      };
    }
  }

  return null;
}
