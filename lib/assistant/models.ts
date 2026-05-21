/** OpenAI model IDs used across Robust assistant surfaces. */

/** General chat agent (typed messages, planning, FAQs). */
export const CHAT_AGENT_MODEL = 'gpt-5.4-mini';

/** Campaign / ad set preset drafting and Meta preset repair. */
export const PRESET_BUILD_MODEL = 'gpt-5.5';

/** Creative copy from video/image analysis (creative-suggest, vision). */
export const CREATIVE_ANALYSIS_MODEL = 'gpt-5.5';

/** Re-export image-gen models for discoverability. */
export {
  CLASSIFIER_MODEL,
  IMAGE_COLLECTOR_MODEL,
  VARIANT_PROMPT_MODEL,
  IMAGE_GENERATION_MODEL,
} from '@/lib/image-gen/models';
