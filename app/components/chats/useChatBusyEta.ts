'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  formatBusyEtaClock,
  formatSavedSecondsMessage,
  randomBusyEtaMs,
} from '@/lib/chats/chat-busy-eta';

const SAVED_MESSAGE_MS = 3200;
const TICK_MS = 1000;

function formatEtaSuffix(remainingMs: number): string {
  return `~${formatBusyEtaClock(Math.max(0, remainingMs))}`;
}

export function useChatBusyEta() {
  const [etaSuffix, setEtaSuffix] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);

  const etaMsRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (deadlineAt == null) return;

    const tick = () => {
      const remaining = deadlineAt - Date.now();
      setEtaSuffix(formatEtaSuffix(remaining));
    };

    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  const begin = useCallback(() => {
    clearSavedTimer();
    setShowSaved(false);
    setSavedMessage(null);

    const etaMs = randomBusyEtaMs();
    etaMsRef.current = etaMs;
    const started = Date.now();
    startedAtRef.current = started;
    setDeadlineAt(started + etaMs);
  }, [clearSavedTimer]);

  const end = useCallback(() => {
    clearSavedTimer();
    setDeadlineAt(null);

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
