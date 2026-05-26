export { CLASSIFIER_MODEL as VIDEO_GEN_CLASSIFIER_MODEL } from '@/lib/image-gen/models';
export { CREATIVE_ANALYSIS_MODEL as VIDEO_SCRIPT_MODEL } from '@/lib/assistant/models';

/** Reasoning effort for script + director prompt generation (Responses API). */
export const VIDEO_SCRIPT_REASONING_EFFORT = 'xhigh' as const;
