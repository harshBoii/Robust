/** One-shot handoff from landing → session page (first message sent on the thread). */

const STORAGE_KEY = 'robust-chat-pending';

export type PendingChatStart = {
  sessionId: string;
  text: string;
  title?: string;
};

function initialSendLockKey(sessionId: string) {
  return `robust-chat-initial-lock-${sessionId}`;
}

export function setPendingChatStart(data: PendingChatStart): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(initialSendLockKey(data.sessionId));
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Read pending start without removing (safe for Strict Mode remounts). */
export function getPendingChatStart(sessionId: string): PendingChatStart | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingChatStart;
    if (data.sessionId !== sessionId || !data.text?.trim()) return null;
    return { ...data, text: data.text.trim() };
  } catch {
    return null;
  }
}

export function clearPendingChatStart(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasInitialSendLock(sessionId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(initialSendLockKey(sessionId)) === '1';
}

export function setInitialSendLock(sessionId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(initialSendLockKey(sessionId), '1');
  clearPendingChatStart();
}
