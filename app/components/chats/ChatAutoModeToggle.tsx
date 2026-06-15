'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import {
  readChatAutoModePreference,
  writeChatAutoModePreference,
} from '@/lib/chats/chat-auto-mode-preference';

type ChatAutoModeToggleProps = {
  sessionId?: string;
  /** When set, overrides local/profile preference (active chat session). */
  sessionAutoMode?: boolean;
  disabled?: boolean;
  /** Renders inline in the composer toolbar. */
  compact?: boolean;
  onChange?: (value: boolean) => void;
};

export function ChatAutoModeToggle({
  sessionId,
  sessionAutoMode,
  disabled,
  compact = false,
  onChange,
}: ChatAutoModeToggleProps) {
  const [autoMode, setAutoMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileDefault, setProfileDefault] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/meta-ads-auto/config', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { config?: { autoModeDefault?: boolean } };
        setProfileDefault(Boolean(data.config?.autoModeDefault));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (sessionAutoMode !== undefined) {
      setAutoMode(sessionAutoMode);
      onChange?.(sessionAutoMode);
      return;
    }
    const stored = readChatAutoModePreference();
    const resolved = stored ?? profileDefault;
    setAutoMode(resolved);
    onChange?.(resolved);
  }, [sessionAutoMode, profileDefault, onChange]);

  const toggle = useCallback(async () => {
    if (disabled || saving) return;
    const next = !autoMode;
    setAutoMode(next);
    writeChatAutoModePreference(next);
    onChange?.(next);
    setSaving(true);
    try {
      if (sessionId) {
        const res = await fetch(`/api/chats/${sessionId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoMode: next }),
        });
        if (!res.ok) setAutoMode(!next);
      }
    } catch {
      setAutoMode(!next);
    } finally {
      setSaving(false);
    }
  }, [autoMode, disabled, onChange, saving, sessionId]);

  const className = compact
    ? `inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
        autoMode
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`
    : `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
        autoMode
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/50 text-muted-foreground hover:border-primary/30'
      }`;

  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={() => void toggle()}
      title="Auto mode — generate statics, resolve campaign/ad set, and draft or publish ads automatically"
      className={className}
    >
      <Sparkles className={compact ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
      Auto
    </button>
  );
}

export function resolveChatAutoModeForNewSession(profileDefault = false): boolean {
  const stored = readChatAutoModePreference();
  return stored ?? profileDefault;
}
