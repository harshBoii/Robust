import type { GroupModel } from '@/lib/create-ad/group-model';
import type { AdsetPreset, CampaignPreset } from '@/app/components/manager/presets/types';

import type { GeoChatState } from '@/lib/geo/chat/types';

export type ChatWorkflowStep =
  | 'geo'
  | 'imageGen'
  | 'videoGen'
  | 'intent'
  | 'platformChoice'
  | 'googleCampaignType'
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
  | 'googleCreative'
  | 'conversionSetup'
  | 'preview'
  | 'publishChoice'
  | 'done';

import type { ImageGenState } from '@/lib/image-gen/types';
import type { VideoGenState } from '@/lib/video-gen/types';

export type WorkflowState = {
  /** GEO strategist agent state (when pathType is GEO). */
  geo?: GeoChatState;
  /** Path B image generation state (when pathType is IMAGE_GEN). */
  imageGen?: ImageGenState;
  /** Video ad generation state (when pathType is VIDEO_GEN). */
  videoGen?: VideoGenState;
  /** Chosen ad platform: 'meta' (default) | 'google' */
  platform?: 'meta' | 'google';
  /** Google Ads campaign type when platform === 'google' */
  googleCampaignType?: 'SEARCH' | 'DISPLAY' | 'PERFORMANCE_MAX';
  /** Google Ads: DB id of selected GoogleCampaign */
  googleCampaignId?: string;
  /** Google Ads: DB id of selected GoogleAdGroup */
  googleAdGroupId?: string;
  /** Google Ads: DB id of selected GoogleAssetGroup (PMax) */
  googleAssetGroupId?: string;
  /** Google Ads: publish job IDs */
  googlePublishJobIds?: string[];
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
  /** Last actionable step the agent chose (persisted for next turn). */
  agentNextStep?: string;
  /** Rolling session memory from the agent (not sent to Meta). */
  agentMemory?: string;
  /** Shown in UI thinking panel only — not inline in messages. */
  lastOperationError?: string | null;
};

export type AdWidgetType =
  | 'mediaSource'
  | 'mediaUpload'
  | 'mediaPick'
  | 'mediaAnalyzing'
  | 'platformChoice'
  | 'googleCampaignType'
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
  | 'googleCreativeForm'
  | 'adPreview'
  | 'publishSchedule'
  | 'done'
  | 'stepNav';

export type ImageGenWidgetType =
  | 'imageGenSourceChoice'
  | 'shopifyProductPicker'
  | 'imageGenUpload'
  | 'imageGenArtistSettings'
  | 'imageGenGenerating'
  | 'imageGenSingleResult'
  | 'imageGenVariantSource'
  | 'imageGenExistingAdPicker'
  | 'imageGenIdeaReview'
  | 'imageGenVariantGrid'
  | 'imageGenModelGallery'
  | 'imageGenBackgroundGallery'
  | 'imageGenPoseGallery'
  | 'imageGenPushToAds'
  | 'imageGenNextStep'
  | 'imageGenRivalInspirationChoice'
  | 'imageGenRivalBrandPicker';

export type VideoGenWidgetType =
  | 'videoGenSubpathChoice'
  | 'videoGenOfferingPicker'
  | 'videoGenAdTypePicker'
  | 'videoGenScriptReview'
  | 'videoGenAdLibraryPicker'
  | 'videoGenAnalyzing'
  | 'videoGenGenerating'
  | 'videoGenHeygenProgress'
  | 'videoGenDone'
  | 'videoGenRivalInspirationChoice'
  | 'videoGenRivalBrandPicker';

export type WidgetType = AdWidgetType | ImageGenWidgetType | VideoGenWidgetType;

export type ChatActionType =
  | 'intent.ack'
  | 'platform.selected'
  | 'google.campaignTypeSelected'
  | 'google.campaignSelected'
  | 'google.adGroupSelected'
  | 'google.creativeSubmitted'
  | 'google.publish.submit'
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
  | 'workflow.goBack'
  | 'imageGen.source'
  | 'imageGen.shopifySelected'
  | 'imageGen.uploaded'
  | 'imageGen.artistSettings'
  | 'imageGen.variantSource'
  | 'imageGen.existingAdSelected'
  | 'imageGen.baseAccepted'
  | 'imageGen.baseRejected'
  | 'imageGen.nextStepChosen'
  | 'imageGen.ideasAccepted'
  | 'imageGen.ideasChanged'
  | 'imageGen.variantRegenerate'
  | 'imageGen.modelSelected'
  | 'imageGen.backgroundSelected'
  | 'imageGen.poseSelected'
  | 'imageGen.onModelAccepted'
  | 'imageGen.onModelRejected'
  | 'imageGen.pushToAds'
  | 'imageGen.rivalInspirationChosen'
  | 'imageGen.rivalBrandChosen'
  | 'videoGen.subpathChosen'
  | 'videoGen.offeringSelected'
  | 'videoGen.adTypeSelected'
  | 'videoGen.trendSubmitted'
  | 'videoGen.scriptApproved'
  | 'videoGen.scriptChangeRequested'
  | 'videoGen.adSelected'
  | 'videoGen.retryIntel'
  | 'videoGen.rivalInspirationChosen'
  | 'videoGen.rivalBrandChosen'
  | 'geo.redditTargetPicked';

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
