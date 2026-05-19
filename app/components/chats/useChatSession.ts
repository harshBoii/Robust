'use client';

import { useCallback, useRef, useState } from 'react';

import { resolveActionUserMessage } from '@/lib/chats/action-user-message';

import { resolveChatBusyTone, type ChatBusyTone } from './chat-busy-tone';
import type { SerializedMessage } from '@/lib/chats/types';
import type { WorkflowState } from '@/lib/chats/types';

/** Widget background work — keep local loaders only, no global thinking panel. */
const SILENT_ACTIONS = new Set(['creative.aiDone']);

export type ChatSessionData = {
  id: string;
  title: string;
  status: string;
  currentStep: string;
  workflowState: WorkflowState;
  bulkUploadId: string | null;
  campaignId: string | null;
  messages: SerializedMessage[];
};

export function useChatSession(sessionId: string) {
  const [session, setSession] = useState<ChatSessionData | null>(null);
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyTone, setBusyTone] = useState<ChatBusyTone>('thinking');
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const operationErrorRef = useRef<string | null>(null);
  operationErrorRef.current = operationError;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${sessionId}`, { credentials: 'include' });
      const data = (await res.json()) as { session?: ChatSessionData; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      if (data.session) {
        setSession(data.session);
        setMessages(data.session.messages ?? []);
        const persisted = data.session.workflowState?.lastOperationError;
        setOperationError(persisted || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const applyResult = useCallback(
    (result: {
      session: ChatSessionData;
      messages: SerializedMessage[];
      newMessages?: SerializedMessage[];
      operationError?: string | null;
      statusTone?: ChatBusyTone;
      recoveredFromError?: boolean;
    }) => {
      setSession(result.session);
      setMessages(result.messages);
      const err =
        result.operationError ??
        result.session.workflowState?.lastOperationError ??
        null;
      setOperationError(err || null);
      if (result.statusTone === 'fixing' || result.recoveredFromError) {
        setBusyTone('fixing');
      } else if (err) {
        setBusyTone('fixing');
      } else if (!result.statusTone) {
        setBusyTone('thinking');
      }
      window.dispatchEvent(new CustomEvent('robust-chats-refresh'));
    },
    [],
  );

  const beginBusy = useCallback(
    (tone: ChatBusyTone) => {
      setBusy(true);
      setBusyTone(tone);
      setError(null);
      setOperationError(null);
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string, currentStep?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const tone = resolveChatBusyTone({
        currentStep: currentStep ?? session?.currentStep,
        hadOperationError: Boolean(operationErrorRef.current),
      });

      const optimisticId = `pending-user-${Date.now()}`;
      const optimistic: SerializedMessage = {
        id: optimisticId,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimistic]);
      beginBusy(tone);

      try {
        const res = await fetch(`/api/chats/${sessionId}/messages`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Send failed');
        applyResult(data);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        const msg = e instanceof Error ? e.message : 'Send failed';
        setOperationError(msg);
        setBusyTone('fixing');
      } finally {
        setBusy(false);
      }
    },
    [sessionId, session?.currentStep, applyResult, beginBusy],
  );

  const appendOptimisticUser = useCallback((text: string) => {
    const optimistic: SerializedMessage = {
      id: `pending-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    return optimistic.id;
  }, []);

  const dispatchAction = useCallback(
    async (
      action: string,
      payload: Record<string, unknown> = {},
      currentStep?: string,
      userMessage?: string,
    ) => {
      const silent = SILENT_ACTIONS.has(action);
      const displayText =
        userMessage?.trim() || resolveActionUserMessage(action, payload) || null;

      const tone = resolveChatBusyTone({
        currentStep: currentStep ?? session?.currentStep,
        action,
        hadOperationError: Boolean(operationErrorRef.current),
      });

      let optimisticId: string | null = null;
      if (!silent && displayText) {
        optimisticId = appendOptimisticUser(displayText);
      }
      if (!silent) beginBusy(tone);

      const { userMessage: _u, ...apiPayload } = payload;

      try {
        if (action === 'creative.aiDone') {
          console.log('[chats:creative-ai] POST actions creative.aiDone', {
            sessionId,
            groups: Array.isArray(payload.groups) ? (payload.groups as unknown[]).length : 0,
          });
        }
        const res = await fetch(`/api/chats/${sessionId}/actions`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            payload: apiPayload,
            userMessage: displayText ?? undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Action failed');
        if (action === 'creative.aiDone') {
          console.log('[chats:creative-ai] creative.aiDone response', {
            sessionId,
            step: data.session?.currentStep,
            messageCount: data.messages?.length,
          });
        }
        applyResult(data);
      } catch (e) {
        if (optimisticId) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
        const msg = e instanceof Error ? e.message : 'Action failed';
        setOperationError(msg);
        setBusyTone('fixing');
      } finally {
        if (!silent) setBusy(false);
      }
    },
    [sessionId, session?.currentStep, applyResult, beginBusy, appendOptimisticUser],
  );

  return {
    session,
    messages,
    loading,
    busy,
    busyTone,
    error,
    operationError,
    load,
    sendMessage,
    dispatchAction,
    setError,
  };
}
