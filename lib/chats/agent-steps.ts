import type { CampaignPreset } from '@/app/components/manager/presets/types';

import { buildGuidedReply } from './guided-replies';
import { getStepResumePrompt } from './step-prompts';
import type { AdWidgetType, ChatWorkflowStep, WorkflowState } from './types';

const AD_WORKFLOW_STEPS = new Set<ChatWorkflowStep>([
  'intent',
  'mediaSource',
  'mediaUpload',
  'mediaPick',
  'mediaAnalyze',
  'campaignChoice',
  'pixelSetup',
  'campaignObjective',
  'campaignSelect',
  'campaignPreset',
  'campaignApprove',
  'adsetChoice',
  'adsetSelect',
  'adsetPreset',
  'adsetApprove',
  'creativeMode',
  'creativeBuild',
  'creativeCsv',
  'preview',
  'publishChoice',
  'done',
]);

/** High-level actionable step the agent must pick every turn (shown as widget + persisted). */
export const AGENT_ACTIONABLE_STEPS = [
  'choose_media',
  'setup_campaign',
  'confirm_pixel',
  'pick_objective',
  'create_preset',
  'review_preset',
  'choose_adset',
  'create_adset_preset',
  'review_adset',
  'choose_creative_mode',
  'analyze_ads',
  'preview_ads',
  'publish',
] as const;

export type AgentActionableStep = (typeof AGENT_ACTIONABLE_STEPS)[number];

export function isAgentActionableStep(value: unknown): value is AgentActionableStep {
  return typeof value === 'string' && AGENT_ACTIONABLE_STEPS.includes(value as AgentActionableStep);
}

function hasMedia(state: WorkflowState): boolean {
  return Boolean(state.bulkUploadId || (state.groups?.length ?? 0) > 0);
}

function campaignDraftReady(state: WorkflowState): boolean {
  const d = state.draftCampaign as CampaignPreset | undefined;
  return Boolean(state.campaignId || (d?.objective && d?.name));
}

function adsetDraftReady(state: WorkflowState): boolean {
  return Boolean(state.defaultAdSetId || state.draftAdset?.name);
}

/** Default next step from workflow progress when the model omits or picks an invalid step. */
export function suggestAgentNextStep(state: WorkflowState): AgentActionableStep {
  if (!hasMedia(state)) return 'choose_media';

  if (!state.campaignId && !campaignDraftReady(state)) {
    if (state.hasPixel === undefined && !state.adType) return 'setup_campaign';
    if (state.hasPixel !== undefined && !state.adType) return 'pick_objective';
    return 'create_preset';
  }

  if (!state.campaignId && campaignDraftReady(state)) return 'review_preset';

  if (state.campaignId && !state.defaultAdSetId && !adsetDraftReady(state)) return 'choose_adset';

  if (state.campaignId && !state.defaultAdSetId && adsetDraftReady(state)) return 'review_adset';

  const groups = state.groups ?? [];
  const included = groups.filter((g) => g.included);
  const hasCopy =
    included.length > 0 &&
    included.every((g) => Boolean(g.creative?.headline?.trim() && g.creative?.primaryText?.trim()));

  if (!state.creativeMode) return 'choose_creative_mode';
  if (!hasCopy) return 'analyze_ads';

  if (state.publishJobIds?.length) return 'publish';

  return 'preview_ads';
}

export function normalizeAgentPlan(
  raw: unknown,
  state: WorkflowState,
): import('./agent-schema').AgentPlan {
  const fallbackNext = suggestAgentNextStep(state);
  let reply = buildGuidedReply(fallbackNext, state);
  let actions: import('./agent-schema').AgentAction[] = [];
  let memory: string | undefined;
  let nextStep: AgentActionableStep = fallbackNext;
  let focusStep: ChatWorkflowStep | undefined;
  let widget: import('./agent-schema').AgentPlan['widget'];

  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (typeof o.reply === 'string' && o.reply.trim()) reply = o.reply.trim();
    if (Array.isArray(o.actions)) actions = o.actions as import('./agent-schema').AgentAction[];
    if (typeof o.memory === 'string') memory = o.memory;
    if (isAgentActionableStep(o.nextStep)) nextStep = o.nextStep;
    if (typeof o.focusStep === 'string' && AD_WORKFLOW_STEPS.has(o.focusStep as ChatWorkflowStep)) {
      focusStep = o.focusStep as ChatWorkflowStep;
    }
    if (o.widget && typeof o.widget === 'object' && o.widget !== null) {
      const w = o.widget as { type?: string; payload?: Record<string, unknown> };
      if (w.type) widget = { type: w.type as AdWidgetType, payload: w.payload };
    }
  }

  return {
    reply,
    nextStep,
    memory,
    focusStep,
    widget,
    actions,
  };
}

export type ResolvedAgentStepUi = {
  focusStep: ChatWorkflowStep;
  widgetType: AdWidgetType;
  widgetPayload?: Record<string, unknown>;
  stepLabel: string;
};

/** Widget + step from actual workflow position (after auto-advance or silent actions). */
export function resolveWorkflowStepUi(
  workflowStep: ChatWorkflowStep,
  state: WorkflowState,
  opts?: { ranPresetBuild?: boolean; builtPresetAdset?: boolean },
): ResolvedAgentStepUi {
  const campaign = state.draftCampaign as CampaignPreset | undefined;
  const adset = state.draftAdset;

  if (opts?.ranPresetBuild) {
    const target = opts.builtPresetAdset ? 'adset' : 'campaign';
    return {
      focusStep: target === 'adset' ? 'adsetApprove' : 'campaignApprove',
      widgetType: 'presetPreview',
      widgetPayload: {
        target,
        campaign: campaign ?? null,
        adset: opts.builtPresetAdset ? adset : null,
      },
      stepLabel: 'Review preset draft',
    };
  }

  const { widgetType } = getStepResumePrompt(workflowStep);
  const base: ResolvedAgentStepUi = {
    focusStep: workflowStep,
    widgetType: widgetType ?? 'mediaSource',
    stepLabel: workflowStep,
  };

  switch (workflowStep) {
    case 'pixelSetup':
      return { ...base, widgetPayload: { hasPixel: state.hasPixel } };
    case 'campaignObjective':
      return { ...base, widgetPayload: { hasPixel: state.hasPixel } };
    case 'campaignPreset':
      return {
        ...base,
        widgetPayload: {
          objective: campaign?.objective ?? state.adType,
          hasPixel: state.hasPixel,
        },
      };
    case 'campaignApprove':
      return {
        ...base,
        widgetType: 'presetPreview',
        widgetPayload: { target: 'campaign', campaign: campaign ?? null, adset: null },
      };
    case 'adsetChoice':
      return { ...base, widgetPayload: { campaignId: state.campaignId } };
    case 'adsetApprove':
      return {
        ...base,
        widgetType: 'presetPreview',
        widgetPayload: {
          target: 'adset',
          campaign: campaign ?? null,
          adset: adset ?? null,
        },
      };
    case 'campaignSelect':
      return { ...base, widgetPayload: { mode: 'campaign' } };
    case 'adsetSelect':
      return { ...base, widgetPayload: { campaignId: state.campaignId } };
    case 'preview':
      return { ...base, widgetPayload: { groups: state.groups } };
    case 'imageGen':
      return { ...base, widgetType: 'mediaSource' };
    default:
      return base;
  }
}

export function workflowStepToAgentNextStep(
  workflowStep: ChatWorkflowStep,
  _state: WorkflowState,
): AgentActionableStep {
  switch (workflowStep) {
    case 'mediaSource':
    case 'mediaUpload':
    case 'mediaPick':
    case 'mediaAnalyze':
      return 'choose_media';
    case 'campaignChoice':
      return 'setup_campaign';
    case 'pixelSetup':
      return 'confirm_pixel';
    case 'campaignObjective':
      return 'pick_objective';
    case 'campaignPreset':
      return 'create_preset';
    case 'campaignApprove':
      return 'review_preset';
    case 'adsetChoice':
      return 'choose_adset';
    case 'adsetPreset':
      return 'create_adset_preset';
    case 'adsetApprove':
      return 'review_adset';
    case 'creativeMode':
      return 'choose_creative_mode';
    case 'creativeBuild':
      return 'analyze_ads';
    case 'creativeCsv':
      return 'choose_creative_mode';
    case 'preview':
      return 'preview_ads';
    case 'publishChoice':
      return 'publish';
    case 'imageGen':
      return 'choose_media';
    default:
      return 'choose_media';
  }
}

export function resolveAgentNextStepUi(
  nextStep: AgentActionableStep,
  state: WorkflowState,
  opts?: { ranPresetBuild?: boolean; builtPresetAdset?: boolean },
): ResolvedAgentStepUi {
  const campaign = state.draftCampaign as CampaignPreset | undefined;
  const adset = state.draftAdset;

  if (opts?.ranPresetBuild && nextStep !== 'choose_media') {
    const target = opts.builtPresetAdset ? 'adset' : 'campaign';
    return {
      focusStep: target === 'adset' ? 'adsetApprove' : 'campaignApprove',
      widgetType: 'presetPreview',
      widgetPayload: {
        target,
        campaign: campaign ?? null,
        adset: opts.builtPresetAdset ? adset : null,
      },
      stepLabel: 'Review preset draft',
    };
  }

  switch (nextStep) {
    case 'choose_media':
      return {
        focusStep: 'mediaSource',
        widgetType: 'mediaSource',
        stepLabel: 'Choose creatives',
      };
    case 'setup_campaign':
      return {
        focusStep: 'campaignChoice',
        widgetType: 'campaignChoice',
        stepLabel: 'Campaign setup',
      };
    case 'confirm_pixel':
      return {
        focusStep: 'pixelSetup',
        widgetType: 'pixelQuestion',
        widgetPayload: { hasPixel: state.hasPixel },
        stepLabel: 'Meta Pixel',
      };
    case 'pick_objective':
      return {
        focusStep: 'campaignObjective',
        widgetType: 'campaignObjective',
        widgetPayload: { hasPixel: state.hasPixel },
        stepLabel: 'Pick objective',
      };
    case 'create_preset':
      return {
        focusStep: 'campaignPreset',
        widgetType: 'campaignPreset',
        widgetPayload: { objective: campaign?.objective ?? state.adType, hasPixel: state.hasPixel },
        stepLabel: 'Build campaign preset',
      };
    case 'review_preset':
      return {
        focusStep: 'campaignApprove',
        widgetType: 'presetPreview',
        widgetPayload: {
          target: 'campaign',
          campaign: campaign ?? null,
          adset: null,
        },
        stepLabel: 'Review campaign preset',
      };
    case 'choose_adset':
      return {
        focusStep: 'adsetChoice',
        widgetType: 'adsetChoice',
        widgetPayload: { campaignId: state.campaignId },
        stepLabel: 'Choose ad set',
      };
    case 'create_adset_preset':
      return {
        focusStep: 'adsetPreset',
        widgetType: 'adsetPreset',
        stepLabel: 'Build ad set preset',
      };
    case 'review_adset':
      return {
        focusStep: 'adsetApprove',
        widgetType: 'presetPreview',
        widgetPayload: {
          target: 'adset',
          campaign: campaign ?? null,
          adset: adset ?? null,
        },
        stepLabel: 'Review ad set preset',
      };
    case 'choose_creative_mode':
      return {
        focusStep: 'creativeMode',
        widgetType: 'creativeMode',
        stepLabel: 'Ad copy mode',
      };
    case 'analyze_ads':
      return {
        focusStep: 'creativeBuild',
        widgetType: 'creativeBuilding',
        stepLabel: 'Analyze & write ad copy',
      };
    case 'preview_ads':
      return {
        focusStep: 'preview',
        widgetType: 'adPreview',
        widgetPayload: { groups: state.groups },
        stepLabel: 'Preview ads',
      };
    case 'publish':
      return {
        focusStep: 'publishChoice',
        widgetType: 'publishSchedule',
        stepLabel: 'Publish',
      };
    default:
      return {
        focusStep: 'mediaSource',
        widgetType: 'mediaSource',
        stepLabel: 'Choose creatives',
      };
  }
}

export function buildAgentStepsCatalogText(): string {
  return `
## Required: nextStep (pick exactly ONE every turn)

You must set "nextStep" to the single actionable step the user should take next. The UI shows a widget for that step. Keep "reply" short (1–3 sentences); do not dump long question lists — the widget is the action.

| nextStep | When to use |
|----------|-------------|
| choose_media | No creatives yet — user must upload, gallery, or bulk |
| setup_campaign | Has media; need new vs existing campaign |
| confirm_pixel | New campaign; pixel not answered |
| pick_objective | Pixel answered; objective not set |
| create_preset | User gave enough to draft (or said "you choose") — pair with preset.build in actions |
| review_preset | Campaign draft ready; user should approve or request edits |
| choose_adset | Campaign on Meta; need ad set |
| create_adset_preset | New ad set; user should describe targeting/budget |
| review_adset | Ad set draft ready; approve or edit |
| choose_creative_mode | Ad set ready; pick AI vs CSV for copy |
| analyze_ads | AI copy: run creative pipeline (groups need headlines) |
| preview_ads | Copy filled; show ad preview |
| publish | Preview approved; schedule or publish |

Also set "memory" (optional): 1–3 sentences to persist — decisions made, goals, budget, geo, open questions.

When the user clearly states a choice in text, either include the matching action in actions[] or rely on auto-advance (one step only). After auto creative.mode, use nextStep analyze_ads — not choose_creative_mode again.
`.trim();
}
