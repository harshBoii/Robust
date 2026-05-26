import 'server-only';

import type { VideoGenActionType } from './types';
import { VIDEO_GEN_AD_CATEGORIES, type VideoGenState, type VideoGenStep } from './types';

export type VideoGenWidgetChoiceOption = {
  optionId: string;
  label: string;
};

export function optionsForVideoGenStep(vg: VideoGenState): VideoGenWidgetChoiceOption[] | null {
  switch (vg.step) {
    case 'offeringPick':
      return (vg.companyContext?.offerings ?? []).map((o) => ({
        optionId: o.id,
        label: o.name,
      }));
    case 'adTypePick':
      return VIDEO_GEN_AD_CATEGORIES.map((c) => ({
        optionId: c.id,
        label: c.label,
      }));
    default:
      return null;
  }
}

export function videoGenStepDescription(step: VideoGenStep): string {
  switch (step) {
    case 'offeringPick':
      return 'Which offering to promote';
    case 'adTypePick':
      return 'Which video ad type to create';
    case 'durationInput':
      return 'Desired ad duration';
    default:
      return step;
  }
}

export function dispatchForVideoGenChoice(
  step: VideoGenStep,
  optionId: string,
): { action: VideoGenActionType; payload: Record<string, unknown> } | null {
  switch (step) {
    case 'offeringPick':
      return { action: 'videoGen.offeringSelected', payload: { offeringId: optionId } };
    case 'adTypePick':
      return { action: 'videoGen.adTypeSelected', payload: { category: optionId } };
    default:
      return null;
  }
}
