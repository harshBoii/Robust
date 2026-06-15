const STORAGE_KEY = 'robust-chats-auto-mode';

export function readChatAutoModePreference(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

export function writeChatAutoModePreference(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}
