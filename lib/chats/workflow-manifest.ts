import type { CampaignPreset } from '@/app/components/manager/presets/types';

import { campaignObjectiveRequiresPixel } from './campaign-objective-rules';
import { workflowHasPixel } from './preset-drafts';
import { getStepResumePrompt } from './step-prompts';
import type { ChatWorkflowStep, WidgetType, WorkflowState } from './types';

export type LogicalStepId =
  | 'platform'
  | 'media'
  | 'pixel'
  | 'campaign'
  | 'adset'
  | 'creative'
  | 'preview'
  | 'publish';

export type LogicalStepDef = {
  id: LogicalStepId;
  label: string;
  required: boolean;
  /** Default UI step when this logical step needs attention. */
  focusStep: ChatWorkflowStep;
  fieldsNeeded: string[];
};

export const LOGICAL_STEPS: LogicalStepDef[] = [
  {
    id: 'platform',
    label: 'Platform',
    required: false,
    focusStep: 'platformChoice',
    fieldsNeeded: ['ad platform (Meta or Google)'],
  },
  {
    id: 'media',
    label: 'Creatives',
    required: true,
    focusStep: 'mediaSource',
    fieldsNeeded: ['creative groups (images/videos)'],
  },
  {
    id: 'pixel',
    label: 'Meta Pixel',
    required: false,
    focusStep: 'pixelSetup',
    fieldsNeeded: ['hasPixel', 'pixelId (if sales/leads)'],
  },
  {
    id: 'campaign',
    label: 'Campaign',
    required: true,
    focusStep: 'campaignChoice',
    fieldsNeeded: ['campaign (existing or new preset)', 'objective', 'budget'],
  },
  {
    id: 'adset',
    label: 'Ad set',
    required: true,
    focusStep: 'adsetChoice',
    fieldsNeeded: ['ad set (existing or new preset)', 'targeting', 'schedule'],
  },
  {
    id: 'creative',
    label: 'Ad copy',
    required: true,
    focusStep: 'creativeMode',
    fieldsNeeded: ['headline and primary text per group'],
  },
  {
    id: 'preview',
    label: 'Preview',
    required: true,
    focusStep: 'preview',
    fieldsNeeded: ['user approval of ad preview'],
  },
  {
    id: 'publish',
    label: 'Publish',
    required: true,
    focusStep: 'publishChoice',
    fieldsNeeded: ['publish or schedule'],
  },
];

function hasCreativesReady(state: WorkflowState): boolean {
  return Boolean(state.bulkUploadId || (state.groups?.length ?? 0) > 0);
}

function campaignDraftReady(state: WorkflowState): boolean {
  const d = state.draftCampaign as CampaignPreset | undefined;
  return Boolean(state.campaignId || (d?.objective && d?.name));
}

function adsetDraftReady(state: WorkflowState): boolean {
  return Boolean(state.defaultAdSetId || state.draftAdset?.name);
}

function creativesHaveCopy(state: WorkflowState): boolean {
  const groups = state.groups ?? [];
  const included = groups.filter((g) => g.included);
  if (included.length === 0) return false;
  return included.every((g) => Boolean(g.creative?.headline?.trim() && g.creative?.primaryText?.trim()));
}

export function isLogicalStepComplete(stepId: LogicalStepId, state: WorkflowState): boolean {
  switch (stepId) {
    case 'platform':
      // Platform step is optional / auto-defaults to meta; treat as complete once any downstream step is set
      return Boolean(state.platform || state.campaignId || state.googleCampaignId);
    case 'media':
      return hasCreativesReady(state);
    case 'pixel':
      if (state.campaignId) return true;
      if (state.hasPixel !== undefined) return true;
      {
        const objective =
          (state.draftCampaign as CampaignPreset | undefined)?.objective ?? state.adType;
        if (objective && !campaignObjectiveRequiresPixel(objective)) return true;
      }
      return workflowHasPixel(state);
    case 'campaign':
      return Boolean(state.campaignId) || campaignDraftReady(state);
    case 'adset':
      return adsetDraftReady(state);
    case 'creative':
      return creativesHaveCopy(state);
    case 'preview':
      return state.creativeMode !== undefined && creativesHaveCopy(state);
    case 'publish':
      return Boolean(
        state.publishJobIds?.length || state.googlePublishJobIds?.length,
      );
    default:
      return false;
  }
}

export function buildWorkflowProgress(
  state: WorkflowState,
  currentStep: ChatWorkflowStep,
): {
  totalSteps: number;
  completedSteps: string[];
  pendingSteps: string[];
  currentFocus: ChatWorkflowStep;
  fieldsNeeded: string[];
  fieldsCollected: Record<string, unknown>;
} {
  const completedSteps = LOGICAL_STEPS.filter((s) => isLogicalStepComplete(s.id, state)).map(
    (s) => s.id,
  );
  const pendingSteps = LOGICAL_STEPS.filter((s) => !isLogicalStepComplete(s.id, state)).map(
    (s) => s.id,
  );

  const fieldsNeeded = LOGICAL_STEPS.filter((s) => !isLogicalStepComplete(s.id, state)).flatMap(
    (s) => s.fieldsNeeded,
  );

  const draft = state.draftCampaign as CampaignPreset | undefined;
  const fieldsCollected: Record<string, unknown> = {
    hasMedia: hasCreativesReady(state),
    groupCount: state.groups?.length ?? 0,
    hasPixel: state.hasPixel,
    pixelId: state.pixelId ? '(set)' : null,
    campaignId: state.campaignId,
    campaignObjective: draft?.objective ?? state.adType,
    campaignName: draft?.name,
    campaignDailyBudget: draft?.dailyBudget,
    campaignLifetimeBudget: draft?.lifetimeBudget,
    adsetId: state.defaultAdSetId,
    adsetName: state.draftAdset?.name,
    tone: state.tone,
    creativeMode: state.creativeMode,
    intentNotes: state.intentNotes,
  };

  return {
    totalSteps: LOGICAL_STEPS.length,
    completedSteps,
    pendingSteps,
    currentFocus: currentStep,
    fieldsNeeded,
    fieldsCollected,
  };
}

export function suggestFocusStep(state: WorkflowState): ChatWorkflowStep {
  for (const step of LOGICAL_STEPS) {
    if (!isLogicalStepComplete(step.id, state)) {
      return step.focusStep;
    }
  }
  return 'done';
}

/** Map agent focusStep to default widget when plan omits widget. */
export function focusStepToWidget(step: ChatWorkflowStep): {
  widgetType: WidgetType | null;
  hint: string;
} {
  const { content, widgetType } = getStepResumePrompt(step);
  return { widgetType, hint: content };
}
