import type { WorkflowState } from '@/lib/chats/types';

export const AUTO_PIPELINE_MILESTONES = [
  'statics',
  'campaign',
  'adset',
  'creative',
  'finish',
] as const;

export type AutoPipelineMilestone = (typeof AUTO_PIPELINE_MILESTONES)[number];

export const AUTO_PIPELINE_MILESTONE_LABELS: Record<AutoPipelineMilestone, string> = {
  statics: 'Generate statics',
  campaign: 'Campaign',
  adset: 'Ad set',
  creative: 'Creatives',
  finish: 'Draft / publish',
};

const MILESTONE_STATUS: Record<AutoPipelineMilestone, readonly string[]> = {
  statics: [
    'Generating ad statics from your brand DNA…',
    'Applying your brand palette and tone…',
    'Rendering campaign-ready frames…',
  ],
  campaign: [
    'Picking the best campaign preset…',
    'Resolving campaign on Meta…',
    'Aligning objective and budget…',
  ],
  adset: [
    'Matching your ad set preset…',
    'Tuning optimization goals…',
    'Creating ad set on Meta…',
  ],
  creative: [
    'Writing AI ad copy…',
    'Uploading Meta creatives…',
    'Pairing copy with your statics…',
  ],
  finish: [
    'Preparing your launch checklist…',
    'Queueing draft ads…',
    'Almost there — hang tight…',
  ],
};

export function isAutoPipelineMilestone(v: string): v is AutoPipelineMilestone {
  return (AUTO_PIPELINE_MILESTONES as readonly string[]).includes(v);
}

export function milestoneIndex(m: AutoPipelineMilestone): number {
  return AUTO_PIPELINE_MILESTONES.indexOf(m);
}

export function isMilestoneDone(
  workflowState: WorkflowState,
  milestone: AutoPipelineMilestone,
): boolean {
  const done = workflowState.autoPipelineMilestonesDone ?? [];
  return done.includes(milestone);
}

export function currentAutoPipelineMilestone(
  workflowState: WorkflowState,
): AutoPipelineMilestone | null {
  const current = workflowState.autoPipelineMilestone;
  if (current && isAutoPipelineMilestone(current)) return current;
  return null;
}

export function isAutoAdsBusy(workflowState: WorkflowState): boolean {
  return workflowState.autoMode === true || Boolean(workflowState.autoPipelineRunId);
}

export function resolveAutoPipelineStatusMessages(
  workflowState: WorkflowState,
): readonly string[] {
  const milestone = currentAutoPipelineMilestone(workflowState);
  if (milestone) return MILESTONE_STATUS[milestone];
  return MILESTONE_STATUS.statics;
}

export function withMilestoneUpdate(
  state: WorkflowState,
  milestone: AutoPipelineMilestone,
  markPreviousDone = true,
): WorkflowState {
  const done = new Set(state.autoPipelineMilestonesDone ?? []);
  if (markPreviousDone) {
    const idx = milestoneIndex(milestone);
    for (let i = 0; i < idx; i++) {
      done.add(AUTO_PIPELINE_MILESTONES[i]!);
    }
  }
  return {
    ...state,
    autoPipelineMilestone: milestone,
    autoPipelineMilestonesDone: [...done],
  };
}

export function withMilestoneComplete(
  state: WorkflowState,
  milestone: AutoPipelineMilestone,
): WorkflowState {
  const done = new Set(state.autoPipelineMilestonesDone ?? []);
  done.add(milestone);
  return {
    ...state,
    autoPipelineMilestonesDone: [...done],
  };
}

export function formatMilestoneProgressMessage(
  milestone: AutoPipelineMilestone,
  detail?: string,
): string {
  const label = AUTO_PIPELINE_MILESTONE_LABELS[milestone];
  const step = milestoneIndex(milestone) + 1;
  const total = AUTO_PIPELINE_MILESTONES.length;
  const prefix = `**Step ${step}/${total} — ${label}**`;
  return detail ? `${prefix}\n${detail}` : prefix;
}
