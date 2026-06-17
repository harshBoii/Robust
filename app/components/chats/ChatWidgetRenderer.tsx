'use client';

import type { WorkflowState } from '@/lib/chats/types';
import type { GroupModel } from '@/app/components/createAd/types';

import { isWidgetActive } from '@/lib/chats/widget-stale';

import { MediaAnalyzingWidget } from './MediaAnalyzingWidget';
import {
  AdPreviewWidget,
  AdSetPickerWidget,
  CampaignObjectiveWidget,
  CampaignPickerWidget,
  ChoiceWidget,
  PixelQuestionWidget,
  CreativeAiWidget,
  CreativeCsvWidget,
  DoneWidget,
  MediaPickWidget,
  MediaSourceWidget,
  MediaUploadWidget,
  PresetPreviewWidget,
  PublishScheduleWidget,
  StepNavWidget,
} from './widgets/ChatWidgets';

import type { ChatWidgetDispatch } from './widgets/ChatWidgets';
import {
  ImageGenBackgroundGalleryWidget,
  ImageGenExistingAdPickerWidget,
  ImageGenGeneratingWidget,
  ImageGenModelGalleryWidget,
  ImageGenArtistSettingsWidget,
  ImageGenNextStepWidget,
  ImageGenPoseGalleryWidget,
  ImageGenPushToAdsWidget,
  ImageGenSingleResultWidget,
  ImageGenSourceChoiceWidget,
  ImageGenUploadWidget,
  ImageGenVariantGridWidget,
  ImageGenTemplateGridWidget,
  ImageGenVariantSourceWidget,
  ImageGenIdeaReviewWidget,
  ShopifyProductPickerWidget,
} from './widgets/ImageGenWidgets';
import {
  GeoBountyPreviewWidget,
  parseGeoBountyPreviewPayload,
} from './widgets/GeoBountyPreviewWidget';
import {
  GeoRedditTargetPickerWidget,
  parseGeoRedditTargetPickerPayload,
} from './widgets/GeoRedditTargetPickerWidget';
import {
  RivalBrandPickerWidget,
  RivalInspirationChoiceWidget,
} from './widgets/RivalInspirationWidgets';
import {
  VideoGenAdLibraryPickerWidget,
  VideoGenAdTypePickerWidget,
  VideoGenAnalyzingWidget,
  VideoGenDoneWidget,
  VideoGenGeneratingWidget,
  VideoGenHeygenProgressWidget,
  VideoGenOfferingPickerWidget,
  VideoGenScriptReviewWidget,
  VideoGenSubpathChoiceWidget,
} from './widgets/VideoGenWidgets';
import {
  GoogleCampaignTypeWidget,
  GoogleCreativeFormWidget,
  PlatformChoiceWidget,
} from './widgets/GoogleAdsWidgets';

export function ChatWidgetRenderer({
  widgetType,
  widgetPayload,
  workflowState,
  currentStep,
  companyId,
  sessionId,
  onAction,
  imageGenArtistInComposer,
  imageGenArtistPickerMode,
}: {
  widgetType: string | null | undefined;
  widgetPayload: unknown;
  workflowState: WorkflowState;
  currentStep: string;
  companyId: string;
  sessionId: string;
  onAction: ChatWidgetDispatch;
  /** Artist/quality dropdowns are shown in the composer footer instead */
  imageGenArtistInComposer?: boolean;
  /** Full composer is replaced by a compact artist picker footer */
  imageGenArtistPickerMode?: boolean;
}) {
  if (!widgetType) return null;

  const payload = (widgetPayload ?? {}) as Record<string, unknown>;
  const groups = (
    widgetType === 'adPreview'
      ? (payload.groups as GroupModel[] | undefined) ?? workflowState.groups
      : workflowState.groups ?? payload.groups
  ) as GroupModel[] | undefined;
  const active = isWidgetActive(widgetType, currentStep, workflowState);

  if (widgetType === 'mediaAnalyzing') {
    return <MediaAnalyzingWidget groups={groups} isActive={active} />;
  }

  /** Image previews persist via ChatMessageMediaPreview; here only interactive controls. */
  if (
    !active &&
    (widgetType === 'imageGenSingleResult' ||
      widgetType === 'imageGenVariantGrid' ||
      widgetType === 'imageGenTemplateGrid')
  ) {
    return null;
  }

  if (widgetType === 'geoBountyPreviews') {
    const preview = parseGeoBountyPreviewPayload(payload);
    if (!preview) return null;
    return <GeoBountyPreviewWidget payload={preview} />;
  }

  if (widgetType === 'geoRedditTargetPicker') {
    const picker = parseGeoRedditTargetPickerPayload(payload);
    if (!picker) return null;
    return (
      <GeoRedditTargetPickerWidget
        payload={picker}
        onAction={onAction}
        disabled={!active}
      />
    );
  }

  /** Auto mode finishes on `done` with read-only previews — keep them visible. */
  if (widgetType === 'adPreview') {
    return (
      <AdPreviewWidget
        groups={groups}
        onAction={onAction}
        readOnly={Boolean(payload.readOnly) || !active}
      />
    );
  }

  if (!active) return null;

  switch (widgetType) {
    case 'mediaSource':
      return <MediaSourceWidget onAction={onAction} />;
    case 'mediaUpload':
      return <MediaUploadWidget companyId={companyId} sessionId={sessionId} onAction={onAction} />;
    case 'mediaPick':
      return <MediaPickWidget onAction={onAction} />;
    case 'campaignChoice':
      return (
        <ChoiceWidget
          options={[
            { value: 'existing', label: 'Existing campaign' },
            { value: 'new', label: 'Create new' },
          ]}
          onPick={(v, label) => void onAction('campaign.choice', { choice: v }, label)}
        />
      );
    case 'pixelQuestion':
      return <PixelQuestionWidget onAction={onAction} />;
    case 'campaignObjective':
      return (
        <CampaignObjectiveWidget
          hasPixel={Boolean(
            workflowState.hasPixel ||
              workflowState.pixelId?.trim() ||
              payload.hasPixel,
          )}
          onAction={onAction}
        />
      );
    case 'campaignPicker':
      return <CampaignPickerWidget onAction={onAction} />;
    case 'campaignPreset':
      return (
        <p className="text-[13px] text-muted-foreground">
          Tell me your campaign goal and budget — just type below.
        </p>
      );
    case 'stepNav':
      return (
        <StepNavWidget
          options={(payload.options as Array<{ step: string; label: string }>) ?? []}
          onAction={onAction}
        />
      );
    case 'presetPreview':
      return (
        <PresetPreviewWidget
          payload={{
            campaign: payload.campaign as import('@/app/components/manager/presets/types').CampaignPreset | null,
            adset: payload.adset as import('@/app/components/manager/presets/types').AdsetPreset | null,
            target: payload.target as string | undefined,
          }}
          onAction={onAction}
          target={(payload.target as 'campaign' | 'adset') ?? 'campaign'}
        />
      );
    case 'adsetChoice':
      return (
        <ChoiceWidget
          options={[
            { value: 'existing', label: 'Existing ad set' },
            { value: 'new', label: 'Create new' },
          ]}
          onPick={(v, label) => void onAction('adset.choice', { choice: v }, label)}
        />
      );
    case 'adsetPicker':
      return (
        <AdSetPickerWidget
          campaignId={(payload.campaignId as string) ?? workflowState.campaignId}
          onAction={onAction}
        />
      );
    case 'adsetPreset':
      return (
        <p className="text-[13px] text-muted-foreground">
          Share ad set budget, schedule, and who you want to reach.
        </p>
      );
    case 'creativeMode':
      return (
        <ChoiceWidget
          options={[
            { value: 'ai', label: 'AI copy' },
            { value: 'csv', label: 'Upload CSV' },
          ]}
          onPick={(v, label) => void onAction('creative.mode', { mode: v }, label)}
        />
      );
    case 'creativeCsv':
      return (
        <CreativeCsvWidget
          groups={groups}
          workflowState={workflowState}
          onAction={onAction}
        />
      );
    case 'creativeBuilding':
      return (
        <CreativeAiWidget
          sessionId={sessionId}
          groups={groups}
          workflowState={workflowState}
          onAction={onAction}
        />
      );
    case 'publishSchedule':
      return <PublishScheduleWidget onAction={onAction} />;
    case 'done':
      return <DoneWidget jobIds={payload.jobIds as string[] | undefined} />;
    case 'imageGenSourceChoice':
      return (
        <ImageGenSourceChoiceWidget
          onAction={onAction}
          mode={payload.mode as string | undefined}
        />
      );
    case 'shopifyProductPicker':
      return <ShopifyProductPickerWidget onAction={onAction} />;
    case 'imageGenUpload':
      return <ImageGenUploadWidget companyId={companyId} onAction={onAction} />;
    case 'imageGenArtistSettings':
      return (
        <ImageGenArtistSettingsWidget
          payload={payload}
          onAction={onAction}
          hideControls={imageGenArtistInComposer}
          pickerMode={imageGenArtistPickerMode}
        />
      );
    case 'imageGenGenerating':
      return <ImageGenGeneratingWidget />;
    case 'imageGenSingleResult':
      return <ImageGenSingleResultWidget payload={payload} />;
    case 'imageGenNextStep':
      return <ImageGenNextStepWidget payload={payload} onAction={onAction} />;
    case 'imageGenVariantSource':
      return <ImageGenVariantSourceWidget onAction={onAction} />;
    case 'imageGenExistingAdPicker':
      return <ImageGenExistingAdPickerWidget onAction={onAction} />;
    case 'imageGenIdeaReview':
      return <ImageGenIdeaReviewWidget payload={payload} onAction={onAction} />;
    case 'imageGenVariantGrid':
      return <ImageGenVariantGridWidget payload={payload} onAction={onAction} />;
    case 'imageGenTemplateGrid':
      return <ImageGenTemplateGridWidget payload={payload} onAction={onAction} />;
    case 'imageGenModelGallery':
      return (
        <ImageGenModelGalleryWidget payload={payload} onAction={onAction} companyId={companyId} />
      );
    case 'imageGenBackgroundGallery':
      return (
        <ImageGenBackgroundGalleryWidget
          payload={payload}
          onAction={onAction}
          companyId={companyId}
        />
      );
    case 'imageGenPoseGallery':
      return (
        <ImageGenPoseGalleryWidget payload={payload} onAction={onAction} companyId={companyId} />
      );
    case 'imageGenPushToAds':
      return (
        <ImageGenPushToAdsWidget
          payload={payload}
          workflowState={workflowState}
          onAction={onAction}
        />
      );
    case 'imageGenRivalInspirationChoice':
      return <RivalInspirationChoiceWidget actionPrefix="imageGen" onAction={onAction} />;
    case 'imageGenRivalBrandPicker':
      return (
        <RivalBrandPickerWidget
          payload={payload}
          actionPrefix="imageGen"
          onAction={onAction}
        />
      );
    case 'videoGenSubpathChoice':
      return <VideoGenSubpathChoiceWidget payload={payload} onAction={onAction} />;
    case 'videoGenOfferingPicker':
      return <VideoGenOfferingPickerWidget payload={payload} onAction={onAction} />;
    case 'videoGenAdTypePicker':
      return <VideoGenAdTypePickerWidget payload={payload} onAction={onAction} />;
    case 'videoGenScriptReview':
      return (
        <VideoGenScriptReviewWidget payload={payload} onAction={onAction} />
      );
    case 'videoGenAdLibraryPicker':
      return <VideoGenAdLibraryPickerWidget payload={payload} onAction={onAction} />;
    case 'videoGenAnalyzing':
      return <VideoGenAnalyzingWidget />;
    case 'videoGenGenerating':
      return <VideoGenGeneratingWidget />;
    case 'videoGenHeygenProgress':
      return (
        <VideoGenHeygenProgressWidget
          sessionId={sessionId}
          payload={payload}
          onAction={onAction}
        />
      );
    case 'videoGenDone':
      return <VideoGenDoneWidget payload={payload} />;
    case 'videoGenRivalInspirationChoice':
      return <RivalInspirationChoiceWidget actionPrefix="videoGen" onAction={onAction} />;
    case 'videoGenRivalBrandPicker':
      return (
        <RivalBrandPickerWidget
          payload={payload}
          actionPrefix="videoGen"
          onAction={onAction}
        />
      );
    case 'platformChoice':
      return <PlatformChoiceWidget onAction={onAction} />;
    case 'googleCampaignType':
      return <GoogleCampaignTypeWidget onAction={onAction} />;
    case 'googleCreativeForm':
      return (
        <GoogleCreativeFormWidget
          campaignType={payload.campaignType as string | undefined}
          onAction={onAction}
        />
      );
    default:
      return null;
  }
}
