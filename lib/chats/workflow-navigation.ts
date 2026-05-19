import type { ChatWorkflowStep, WorkflowState } from './types';

export type BackStepOption = { step: ChatWorkflowStep; label: string };

/** Steps the user may jump back to from the current step. */
export function getBackStepOptions(
  current: ChatWorkflowStep,
  state: WorkflowState,
): BackStepOption[] {
  const hasMedia = Boolean(state.bulkUploadId || (state.groups?.length ?? 0) > 0);
  const options: BackStepOption[] = [];

  const add = (step: ChatWorkflowStep, label: string) => {
    if (step !== current && !options.some((o) => o.step === step)) {
      options.push({ step, label });
    }
  };

  switch (current) {
    case 'mediaUpload':
    case 'mediaPick':
    case 'mediaAnalyze':
      add('mediaSource', 'Change how creatives are added');
      break;
    case 'pixelSetup':
    case 'campaignObjective':
    case 'campaignSelect':
    case 'campaignPreset':
    case 'campaignApprove':
      if (hasMedia) add('mediaSource', 'Change creatives');
      add('campaignChoice', 'Campaign: existing or new');
      if (current !== 'pixelSetup') add('pixelSetup', 'Change pixel setup');
      break;
    case 'adsetSelect':
    case 'adsetPreset':
    case 'adsetApprove':
      add('adsetChoice', 'Ad set: existing or new');
      add('campaignChoice', 'Change campaign');
      if (hasMedia) add('mediaSource', 'Change creatives');
      break;
    case 'creativeMode':
    case 'creativeCsv':
    case 'creativeBuild':
      add('adsetChoice', 'Change ad set');
      add('campaignChoice', 'Change campaign');
      if (hasMedia) add('mediaSource', 'Change creatives');
      break;
    case 'preview':
    case 'publishChoice':
      add('creativeMode', 'Change creative copy');
      add('adsetChoice', 'Change ad set');
      add('campaignChoice', 'Change campaign');
      if (hasMedia) add('mediaSource', 'Change creatives');
      break;
    case 'adsetChoice':
      add('campaignChoice', 'Change campaign');
      if (hasMedia) add('mediaSource', 'Change creatives');
      break;
    case 'campaignChoice':
      if (hasMedia) add('mediaSource', 'Change creatives');
      break;
    default:
      break;
  }

  return options;
}

export function isAllowedBackStep(
  from: ChatWorkflowStep,
  to: ChatWorkflowStep,
  state: WorkflowState,
): boolean {
  return getBackStepOptions(from, state).some((o) => o.step === to);
}

/** Clear downstream state when rewinding the funnel. */
export function applyGoBackStateReset(
  targetStep: ChatWorkflowStep,
  state: WorkflowState,
): WorkflowState {
  const next = { ...state };
  const clearsCampaign =
    targetStep === 'campaignChoice' ||
    targetStep === 'pixelSetup' ||
    targetStep === 'campaignObjective' ||
    targetStep === 'campaignSelect' ||
    targetStep === 'campaignPreset' ||
    targetStep === 'mediaSource' ||
    targetStep === 'mediaUpload' ||
    targetStep === 'mediaPick';
  const clearsAdset =
    clearsCampaign ||
    targetStep === 'adsetChoice' ||
    targetStep === 'adsetSelect' ||
    targetStep === 'adsetPreset';
  const clearsCreatives =
    targetStep === 'creativeMode' ||
    targetStep === 'creativeCsv' ||
    targetStep === 'creativeBuild' ||
    targetStep === 'preview' ||
    targetStep === 'publishChoice';

  if (clearsCampaign) {
    delete next.campaignId;
    delete next.campaignPresetId;
    delete next.draftCampaign;
    delete next.hasPixel;
    delete next.pixelId;
    delete next.trafficOptimizationGoal;
    next.presetChatMessages = [];
  }
  if (clearsAdset) {
    delete next.defaultAdSetId;
    delete next.adsetPresetId;
    delete next.draftAdset;
    if (targetStep === 'adsetChoice' || clearsCampaign) {
      next.presetChatMessages = [];
    }
  }
  if (clearsCreatives && next.groups) {
    next.groups = next.groups.map((g) => ({
      ...g,
      creative: {
        ...g.creative,
        headline: g.creative.headline || '',
        primaryText: g.creative.primaryText || '',
      },
    }));
    delete next.creativeMode;
  }
  if (targetStep === 'campaignObjective') {
    delete next.draftCampaign;
    next.presetChatMessages = [];
  }
  if (targetStep === 'campaignPreset') {
    next.presetTarget = 'campaign';
    next.draftCampaign = next.draftCampaign ?? undefined;
  }
  if (targetStep === 'adsetPreset') {
    next.presetTarget = 'adset';
  }
  return next;
}
