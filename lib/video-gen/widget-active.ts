import type { VideoGenState, VideoGenStep } from './types';

const WIDGET_TO_STEP: Record<string, VideoGenStep> = {
  videoGenSubpathChoice: 'routing',
  videoGenOfferingPicker: 'offeringPick',
  videoGenAdTypePicker: 'adTypePick',
  videoGenAdLibraryPicker: 'adLibraryPick',
  videoGenScriptReview: 'reviewScript',
  videoGenAnalyzing: 'analyzingAds',
  videoGenGenerating: 'generatingScript',
  videoGenHeygenProgress: 'heygenPolling',
  videoGenDone: 'done',
};

/** Only the widget for the current video-gen step stays interactive (avoids stale duplicates). */
export function isVideoGenWidgetActive(
  widgetType: string,
  videoGen: VideoGenState | undefined,
): boolean {
  if (!videoGen) return false;
  const expected = WIDGET_TO_STEP[widgetType];
  if (!expected) return true;

  if (widgetType === 'videoGenAnalyzing') {
    return (
      videoGen.step === 'analyzingAds' ||
      videoGen.step === 'fetchTopAds' ||
      videoGen.step === 'runningIntel'
    );
  }
  if (widgetType === 'videoGenHeygenProgress') {
    return videoGen.step === 'heygenGenerating' || videoGen.step === 'heygenPolling';
  }

  return videoGen.step === expected;
}
