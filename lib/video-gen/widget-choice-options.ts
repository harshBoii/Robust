import 'server-only';

import type { WidgetChoiceOption } from '@/lib/chats/classify-widget-choice';

import type { VideoGenActionType, VideoGenState } from './types';
import { VIDEO_GEN_AD_CATEGORIES } from './types';

export function videoGenStepDescription(step: VideoGenState['step']): string {
  switch (step) {
    case 'routing':
      return 'Choose how to create your video ad';
    case 'offeringPick':
      return 'Which offering or product to promote';
    case 'adTypePick':
      return 'What type of video ad to create';
    case 'adLibraryPick':
      return 'Which existing video ad to replicate';
    default:
      return step;
  }
}

export function optionsForVideoGenStep(
  vg: VideoGenState,
  extras?: { libraryAssets?: Array<{ id: string; title: string }> },
): WidgetChoiceOption[] | null {
  switch (vg.step) {
    case 'routing':
      return [
        {
          optionId: 'mrAdicasso',
          label: 'Mr. Adicasso',
          description: 'AI-driven creative from brand context',
        },
        {
          optionId: 'learnAndBuild',
          label: 'Learn and Build',
          description: 'From top performing ads',
        },
        {
          optionId: 'replicate',
          label: 'Replicate an Ad',
          description: 'Match an existing ad',
        },
      ];
    case 'offeringPick':
      return (vg.companyContext?.offerings ?? []).map((o) => ({
        optionId: o.id,
        label: o.name,
        description: o.description ?? undefined,
      }));
    case 'adTypePick':
      return VIDEO_GEN_AD_CATEGORIES.map((c) => ({
        optionId: c.id,
        label: c.label,
      }));
    case 'adLibraryPick':
      return (extras?.libraryAssets ?? []).map((a) => ({
        optionId: a.id,
        label: a.title,
      }));
    default:
      return null;
  }
}

export type VideoGenChoiceDispatch = {
  action: VideoGenActionType;
  payload: Record<string, unknown>;
};

export function dispatchForVideoGenChoice(
  step: VideoGenState['step'],
  optionId: string,
): VideoGenChoiceDispatch | null {
  switch (step) {
    case 'routing':
      if (optionId === 'mrAdicasso' || optionId === 'learnAndBuild' || optionId === 'replicate') {
        return { action: 'videoGen.subpathChosen', payload: { subpath: optionId } };
      }
      return null;
    case 'offeringPick':
      if (optionId) {
        return { action: 'videoGen.offeringSelected', payload: { offeringId: optionId } };
      }
      return null;
    case 'adTypePick':
      if (optionId) {
        return { action: 'videoGen.adTypeSelected', payload: { category: optionId } };
      }
      return null;
    case 'adLibraryPick':
      if (optionId) {
        return { action: 'videoGen.adSelected', payload: { assetId: optionId } };
      }
      return null;
    default:
      return null;
  }
}
