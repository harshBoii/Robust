import type { VideoGenStep } from '@/lib/video-gen/types';

import type { ChatWorkflowStep, WorkflowState } from './types';

/** Widget types that may only render while the session is on a matching step. */
const WIDGET_STEP: Record<string, ChatWorkflowStep[]> = {
  mediaSource: ['intent', 'mediaSource'],
  mediaUpload: ['mediaUpload'],
  mediaPick: ['mediaPick'],
  mediaAnalyzing: ['mediaAnalyze'],
  campaignChoice: ['campaignChoice'],
  pixelQuestion: ['pixelSetup'],
  campaignObjective: ['campaignObjective'],
  campaignPicker: ['campaignSelect'],
  campaignPreset: ['campaignPreset', 'campaignApprove'],
  presetPreview: ['campaignApprove', 'adsetApprove'],
  adsetChoice: ['adsetChoice'],
  adsetPicker: ['adsetSelect'],
  adsetPreset: ['adsetPreset', 'adsetApprove'],
  creativeMode: ['creativeMode'],
  creativeCsv: ['creativeCsv'],
  creativeBuilding: ['creativeBuild'],
  adPreview: ['preview'],
  publishSchedule: ['publishChoice'],
  done: ['done'],
  imageGenSourceChoice: ['imageGen'],
  shopifyProductPicker: ['imageGen'],
  imageGenUpload: ['imageGen'],
  imageGenArtistSettings: ['imageGen'],
  imageGenGenerating: ['imageGen'],
  imageGenSingleResult: ['imageGen'],
  imageGenNextStep: ['imageGen'],
  imageGenVariantSource: ['imageGen'],
  imageGenExistingAdPicker: ['imageGen'],
  imageGenIdeaReview: ['imageGen'],
  imageGenVariantGrid: ['imageGen'],
  imageGenTemplateGrid: ['imageGen'],
  imageGenModelGallery: ['imageGen'],
  imageGenBackgroundGallery: ['imageGen'],
  imageGenPoseGallery: ['imageGen'],
  imageGenPushToAds: ['imageGen', 'campaignChoice'],
  videoGenSubpathChoice: ['videoGen'],
  videoGenOfferingPicker: ['videoGen'],
  videoGenAdTypePicker: ['videoGen'],
  videoGenScriptReview: ['videoGen'],
  videoGenAdLibraryPicker: ['videoGen'],
  videoGenAnalyzing: ['videoGen'],
  videoGenGenerating: ['videoGen'],
  videoGenHeygenProgress: ['videoGen'],
  videoGenDone: ['videoGen'],
  geoBountyPreviews: ['geo'],
  geoRedditTargetPicker: ['geo'],
  stepNav: [
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
    'creativeCsv',
    'creativeBuild',
    'preview',
    'publishChoice',
  ],
};

const VIDEO_GEN_WIDGET_STEP: Record<string, VideoGenStep | VideoGenStep[]> = {
  videoGenSubpathChoice: 'routing',
  videoGenOfferingPicker: 'offeringPick',
  videoGenAdTypePicker: 'adTypePick',
  videoGenScriptReview: 'reviewScript',
  videoGenAdLibraryPicker: 'adLibraryPick',
  videoGenAnalyzing: ['analyzingAds', 'runningIntel', 'fetchTopAds'],
  videoGenGenerating: 'generatingScript',
  videoGenHeygenProgress: ['heygenGenerating', 'heygenPolling'],
  videoGenDone: 'done',
};

export function isVideoGenWidgetActive(
  widgetType: string,
  videoStep: VideoGenStep | undefined,
): boolean {
  if (!widgetType.startsWith('videoGen') || !videoStep) return false;
  const required = VIDEO_GEN_WIDGET_STEP[widgetType];
  if (!required) return true;
  if (Array.isArray(required)) return required.includes(videoStep);
  return required === videoStep;
}

export function isWidgetActive(
  widgetType: string,
  currentStep: string,
  workflowState?: WorkflowState,
): boolean {
  if (widgetType.startsWith('videoGen')) {
    if (currentStep !== 'videoGen') return false;
    return isVideoGenWidgetActive(widgetType, workflowState?.videoGen?.step);
  }
  const allowed = WIDGET_STEP[widgetType];
  if (!allowed) return true;
  return allowed.includes(currentStep as ChatWorkflowStep);
}
