import { getInitialSendText, getPendingChatStart } from './chat-pending-storage';

/** Text for landing → session handoff (survives pending clear + Strict Mode remount). */
export function resolveInitialHandoffText(
  sessionId: string,
  optionsText?: string | null,
): string {
  const fromOptions = optionsText?.trim();
  if (fromOptions) return fromOptions;
  const pending = getPendingChatStart(sessionId);
  if (pending?.text?.trim()) return pending.text.trim();
  return getInitialSendText(sessionId)?.trim() ?? '';
}
