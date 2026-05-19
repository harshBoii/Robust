import type { ChatWorkflowStep } from '@/lib/chats/types';

const FIXING_STEPS: ChatWorkflowStep[] = [
  'campaignPreset',
  'campaignApprove',
  'adsetPreset',
  'adsetApprove',
];

const FIXING_ACTIONS = new Set(['campaign.approved', 'adset.approved']);

export type ChatBusyTone = 'thinking' | 'fixing';

export function resolveChatBusyTone(input: {
  currentStep?: string;
  action?: string;
  hadOperationError?: boolean;
  serverTone?: ChatBusyTone;
}): ChatBusyTone {
  if (input.serverTone === 'fixing') return 'fixing';
  if (input.action && FIXING_ACTIONS.has(input.action)) return 'fixing';
  if (input.currentStep && FIXING_STEPS.includes(input.currentStep as ChatWorkflowStep)) {
    return 'fixing';
  }
  if (input.hadOperationError) return 'fixing';
  return 'thinking';
}
