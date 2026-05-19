import type { ChatWorkflowStep, WorkflowState } from './types';

/** Composer chips aligned with agent nextStep or workflow step (client-safe). */
export function composerSuggestions(
  step: string | undefined,
  workflowState: WorkflowState,
): string[] | undefined {
  const agent = workflowState.agentNextStep;

  if (agent === 'choose_media' || step === 'mediaSource') {
    return ['Upload here', 'Pick from gallery', 'Bulk upload'];
  }
  if (agent === 'setup_campaign' || step === 'campaignChoice') {
    return ['Use existing campaign', 'Create a new campaign'];
  }
  if (agent === 'choose_adset' || step === 'adsetChoice') {
    return ['Use existing ad set', 'Create a new ad set'];
  }
  if (agent === 'choose_creative_mode' || step === 'creativeMode') {
    return ['Write copy with AI', 'I have a CSV'];
  }
  if (agent === 'create_preset') {
    return ['Draft campaign for me', '₹1500/day traffic campaign'];
  }
  if (step === 'intent') {
    return ['Post an ad', "Mother's Day tier-2 India", 'Help me launch a campaign'];
  }
  return undefined;
}
