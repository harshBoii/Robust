import { getInitialSendText, getPendingChatStart } from './chat-pending-storage';
import { readChatAutoModePreference } from '@/lib/chats/chat-auto-mode-preference';

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

/** Auto mode flag for landing → session handoff (before GET session returns). */
export function resolveInitialHandoffAutoMode(sessionId: string): boolean {
  const pending = getPendingChatStart(sessionId);
  if (pending?.autoMode === true) return true;
  if (pending?.autoMode === false) return false;
  return readChatAutoModePreference() ?? false;
}
