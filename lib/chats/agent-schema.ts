import { z } from 'zod';

import { CAMPAIGN_OBJECTIVE_OPTIONS } from '@/lib/assistant/constants';

import { AGENT_ACTIONABLE_STEPS } from './agent-steps';

const chatWorkflowSteps = z.enum([
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

const widgetTypes = z.enum([
  'mediaSource',
  'mediaUpload',
  'mediaPick',
  'mediaAnalyzing',
  'campaignChoice',
  'pixelQuestion',
  'campaignObjective',
  'campaignPicker',
  'campaignPreset',
  'presetPreview',
  'adsetChoice',
  'adsetPicker',
  'adsetPreset',
  'creativeMode',
  'creativeCsv',
  'creativeBuilding',
  'adPreview',
  'publishSchedule',
  'done',
  'stepNav',
]);

export const STATE_PATCH_ALLOWLIST = [
  'tone',
  'adType',
  'trafficOptimizationGoal',
  'intentNotes',
  'agentMemory',
] as const;

export const statePatchPayloadSchema = z.object({
  tone: z.string().max(200).optional(),
  adType: z.enum(CAMPAIGN_OBJECTIVE_OPTIONS).optional(),
  trafficOptimizationGoal: z.enum(['LINK_CLICKS', 'LANDING_PAGE_VIEWS']).optional(),
  intentNotes: z.string().max(2000).optional(),
});

export const agentActionSchema = z.object({
  action: z.string().min(1).max(80),
  payload: z.record(z.unknown()).optional(),
});

export const agentPlanSchema = z.object({
  reply: z.string().min(1).max(8000),
  /** Required actionable step — drives widget + persisted state. */
  nextStep: z.enum(AGENT_ACTIONABLE_STEPS),
  /** Short session memory persisted for following turns. */
  memory: z.string().max(4000).optional(),
  focusStep: chatWorkflowSteps.optional(),
  widget: z
    .object({
      type: widgetTypes,
      payload: z.record(z.unknown()).optional(),
    })
    .optional(),
  actions: z.array(agentActionSchema).max(5).default([]),
});

export type AgentPlan = z.infer<typeof agentPlanSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type StatePatchPayload = z.infer<typeof statePatchPayloadSchema>;
