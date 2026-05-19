import type { GroupModel } from '@/lib/create-ad/group-model';
import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';

export type ChatWorkflowStep =
  | 'intent'
  | 'mediaSource'
  | 'mediaUpload'
  | 'mediaPick'
  | 'mediaAnalyze'
  | 'campaignChoice'
  | 'pixelSetup'
  | 'campaignObjective'
  | 'campaignSelect'
  | 'campaignPreset'
  | 'campaignApprove'
  | 'adsetChoice'
  | 'adsetSelect'
  | 'adsetPreset'
  | 'adsetApprove'
  | 'creativeMode'
  | 'creativeBuild'
  | 'creativeCsv'
  | 'preview'
  | 'publishChoice'
  | 'done';

export type WorkflowState = {
  bulkUploadId?: string;
  assetIds?: string[];
  groups?: GroupModel[];
  campaignId?: string;
  defaultAdSetId?: string;
  draftCampaign?: Partial<CampaignPreset> | null;
  draftAdset?: Partial<AdsetPreset> | null;
  campaignPresetId?: string;
  adsetPresetId?: string;
  tone?: string;
  adType?: string;
  creativeMode?: 'ai' | 'csv';
  publishJobIds?: string[];
  presetChatMessages?: { role: 'user' | 'assistant'; content: string }[];
  presetTarget?: 'campaign' | 'adset';
  /** User confirmed they have a Meta pixel (or selected one). */
  hasPixel?: boolean;
  pixelId?: string | null;
  /** Default ad set goal when campaign is OUTCOME_TRAFFIC without pixel. */
  trafficOptimizationGoal?: 'LINK_CLICKS' | 'LANDING_PAGE_VIEWS';
  /** Agent notes from conversation (not sent to Meta). */
  intentNotes?: string;
  /** Shown in UI thinking panel only — not inline in messages. */
  lastOperationError?: string | null;
};

export type WidgetType =
  | 'mediaSource'
  | 'mediaUpload'
  | 'mediaPick'
  | 'mediaAnalyzing'
  | 'campaignChoice'
  | 'pixelQuestion'
  | 'campaignObjective'
  | 'campaignPicker'
  | 'campaignPreset'
  | 'presetPreview'
  | 'adsetChoice'
  | 'adsetPicker'
  | 'adsetPreset'
  | 'creativeMode'
  | 'creativeCsv'
  | 'creativeBuilding'
  | 'adPreview'
  | 'publishSchedule'
  | 'done'
  | 'stepNav';

export type ChatActionType =
  | 'intent.ack'
  | 'media.source'
  | 'media.uploaded'
  | 'media.analyzed'
  | 'media.galleryPicked'
  | 'campaign.choice'
  | 'pixel.answered'
  | 'campaign.objectivePicked'
  | 'campaign.selected'
  | 'campaign.presetUpdated'
  | 'campaign.approved'
  | 'adset.choice'
  | 'adset.selected'
  | 'adset.presetUpdated'
  | 'adset.approved'
  | 'creative.mode'
  | 'creative.csvParsed'
  | 'creative.aiDone'
  | 'preview.approved'
  | 'preview.changes'
  | 'publish.submit'
  | 'workflow.goBack';

export type SerializedMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string | null;
  widgetType?: string | null;
  widgetPayload?: unknown;
  createdAt: string;
};

export type OrchestratorResult = {
  session: {
    id: string;
    title: string;
    status: string;
    currentStep: ChatWorkflowStep;
    workflowState: WorkflowState;
    bulkUploadId: string | null;
    campaignId: string | null;
  };
  messages: SerializedMessage[];
  newMessages: SerializedMessage[];
  /** Meta/create failure for the thinking-panel error dropdown (not a top banner). */
  operationError?: string | null;
  /** UI tone for the status panel (fixing vs thinking). */
  statusTone?: 'thinking' | 'fixing';
  /** True when Meta/preset auto-recovery ran during this turn. */
  recoveredFromError?: boolean;
};
