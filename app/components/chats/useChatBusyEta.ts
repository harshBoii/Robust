'use client';

import { useCallback, useRef, useState } from 'react';

import {
  formatBusyEtaClock,
  formatSavedSecondsMessage,
  randomBusyEtaMs,
} from '@/lib/chats/chat-busy-eta';

const SAVED_MESSAGE_MS = 3200;

export function useChatBusyEta() {
  const [etaSuffix, setEtaSuffix] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const etaMsRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    clearSavedTimer();
    setShowSaved(false);
    setSavedMessage(null);

    const etaMs = randomBusyEtaMs();
    etaMsRef.current = etaMs;
    startedAtRef.current = Date.now();
    setEtaSuffix(`~${formatBusyEtaClock(etaMs)}`);
  }, [clearSavedTimer]);

  const end = useCallback(() => {
    clearSavedTimer();

    const started = startedAtRef.current;
    const etaMs = etaMsRef.current;
    startedAtRef.current = null;
    etaMsRef.current = null;
    setEtaSuffix(null);

    if (!started || !etaMs) return;

    const elapsed = Date.now() - started;
    if (elapsed < etaMs) {
      const savedSeconds = Math.max(1, Math.round((etaMs - elapsed) / 1000));
      setSavedMessage(formatSavedSecondsMessage(savedSeconds));
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => {
        setShowSaved(false);
        setSavedMessage(null);
        savedTimerRef.current = null;
      }, SAVED_MESSAGE_MS);
    }
  }, [clearSavedTimer]);

  return {
    begin,
    end,
    etaSuffix,
    savedMessage,
    showSaved,
  };
}
