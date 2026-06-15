'use client';

import { Check } from 'lucide-react';

import {
  AUTO_PIPELINE_MILESTONES,
  AUTO_PIPELINE_MILESTONE_LABELS,
  currentAutoPipelineMilestone,
  isMilestoneDone,
  type AutoPipelineMilestone,
} from '@/lib/chats/auto-ads/milestones';
import type { WorkflowState } from '@/lib/chats/types';

function MilestoneStep({
  milestone,
  workflowState,
  active,
}: {
  milestone: AutoPipelineMilestone;
  workflowState: WorkflowState;
  active: boolean;
}) {
  const done = isMilestoneDone(workflowState, milestone);
  const label = AUTO_PIPELINE_MILESTONE_LABELS[milestone];

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <div
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition',
          done
            ? 'border-primary bg-primary text-primary-foreground'
            : active
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border/60 bg-muted/30 text-muted-foreground',
        ].join(' ')}
      >
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
      </div>
      <span
        className={[
          'max-w-[4.5rem] text-center text-[10px] leading-tight',
          done || active ? 'font-medium text-foreground' : 'text-muted-foreground',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  );
}

export function AutoPipelineMilestones({
  workflowState,
  className = '',
}: {
  workflowState: WorkflowState;
  className?: string;
}) {
  const current = currentAutoPipelineMilestone(workflowState);
  const activeIdx = current ? AUTO_PIPELINE_MILESTONES.indexOf(current) : 0;

  return (
    <div
      className={[
        'rounded-xl border border-border/30 bg-muted/15 px-3 py-3',
        className,
      ].join(' ')}
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Auto pipeline
      </p>
      <div className="relative flex items-start justify-between gap-1">
        <div
          className="pointer-events-none absolute left-[14px] right-[14px] top-[14px] h-px bg-border/50"
          aria-hidden
        />
        {AUTO_PIPELINE_MILESTONES.map((milestone, idx) => (
          <MilestoneStep
            key={milestone}
            milestone={milestone}
            workflowState={workflowState}
            active={idx === activeIdx && !isMilestoneDone(workflowState, milestone)}
          />
        ))}
      </div>
    </div>
  );
}
