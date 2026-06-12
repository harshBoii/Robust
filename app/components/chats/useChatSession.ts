'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { resolveActionUserMessage } from '@/lib/chats/action-user-message';
import { shouldSkipActionUserBubble } from '@/lib/chats/user-message-policy';

import {
  clearInitialSendLock,
  hasInitialSendLock,
  setInitialSendLock,
} from './chat-pending-storage';
import { resolveInitialHandoffText } from './resolve-initial-handoff-text';
import { resolveChatBusyTone, type ChatBusyTone } from './chat-busy-tone';
import {
  captureReconcileSnapshot,
  isNetworkFailure,
  reconcileSessionAfterNetworkError,
} from './reconcile-session-after-network-error';
import { useChatBusyEta } from './useChatBusyEta';
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

export type UseChatSessionOptions = {
  initialMessage?: string | null;
  initialTitle?: string | null;
};

function stubSession(sessionId: string, title: string): ChatSessionData {
  return {
    id: sessionId,
    title,
    status: 'ACTIVE',
    currentStep: 'intent',
    workflowState: {},
    bulkUploadId: null,
    campaignId: null,
    messages: [],
  };
}

function optimisticUserMessage(text: string, id: string): SerializedMessage {
  return {
    id,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString(),
  };
}

function pendingCoveredByAttachmentMessage(
  serverMsgs: SerializedMessage[],
  pendingText: string,
): boolean {
  return serverMsgs.some((m) => {
    if (m.role !== 'user' || m.widgetType !== 'chatAttachments') return false;
    const items = (m.widgetPayload as { items?: { fileName?: string }[] } | undefined)?.items;
    return items?.some((item) => item.fileName?.trim() === pendingText) ?? false;
  });
}

function mergeMessagesKeepingPendingUser(
  serverMsgs: SerializedMessage[],
  prev: SerializedMessage[],
): SerializedMessage[] {
  const pendingUser = prev.find((m) => m.id.startsWith('pending-user-'));
  if (!pendingUser?.content?.trim()) return serverMsgs;
  const pendingText = pendingUser.content.trim();
  const hasSameUser = serverMsgs.some(
    (m) => m.role === 'user' && m.content?.trim() === pendingText,
  );
  if (hasSameUser || pendingCoveredByAttachmentMessage(serverMsgs, pendingText)) {
    return serverMsgs;
  }
  return [...serverMsgs, pendingUser];
}

function sessionHasAssistantReplyAfterUser(
  msgs: SerializedMessage[],
  userText: string,
): boolean {
  const want = userText.trim();
  if (!want) return false;
  const userIdx = msgs.findIndex((m) => m.role === 'user' && m.content?.trim() === want);
  if (userIdx < 0) return false;
  return msgs.slice(userIdx + 1).some((m) => m.role === 'assistant');
}

async function pollSessionAfterInitialSend(
  sessionId: string,
  initialText: string,
): Promise<ChatSessionData | null> {
  const want = initialText.trim();
  for (let attempt = 0; attempt < 45; attempt++) {
    const res = await fetch(`/api/chats/${sessionId}`, { credentials: 'include' });
    const data = (await res.json()) as { session?: ChatSessionData; error?: string };
    if (res.ok && data.session) {
      const msgs = data.session.messages ?? [];
      if (sessionHasAssistantReplyAfterUser(msgs, want)) return data.session;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

export function useChatSession(sessionId: string, options?: UseChatSessionOptions) {
  const initialText = resolveInitialHandoffText(sessionId, options?.initialMessage);
  const hasInitialSend = Boolean(initialText);
  const initialTitle = options?.initialTitle?.trim() || initialText.slice(0, 80) || 'New chat';
  const initialOptimisticId = `pending-user-initial-${sessionId}`;

  const [session, setSession] = useState<ChatSessionData | null>(() =>
    hasInitialSend ? stubSession(sessionId, initialTitle) : null,
  );
  const [messages, setMessages] = useState<SerializedMessage[]>(() =>
    hasInitialSend ? [optimisticUserMessage(initialText, initialOptimisticId)] : [],
  );
  const [loading, setLoading] = useState(!hasInitialSend);
  const [busy, setBusy] = useState(hasInitialSend);
  const [busyTone, setBusyTone] = useState<ChatBusyTone>('thinking');
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const operationErrorRef = useRef<string | null>(null);
  operationErrorRef.current = operationError;
  const initialSendStarted = useRef(false);
  /** After landing handoff, storage clears and hasInitialSend flips false — skip a redundant full-page load(). */
  const skipLoadAfterHandoffRef = useRef(hasInitialSend);
  const busyEta = useChatBusyEta();
  const etaTrackingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chats/${sessionId}`, { credentials: 'include' });
      const data = (await res.json()) as { session?: ChatSessionData; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      if (data.session) {
        setSession(data.session);
        setMessages((prev) =>
          mergeMessagesKeepingPendingUser(data.session!.messages ?? [], prev),
        );
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
      setMessages((prev) =>
        mergeMessagesKeepingPendingUser(result.messages ?? [], prev),
      );
      clearInitialSendLock(sessionId);
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
      if (tone === 'thinking') {
        busyEta.begin();
        etaTrackingRef.current = true;
      } else {
        etaTrackingRef.current = false;
      }
    },
    [busyEta],
  );

  const endBusy = useCallback(() => {
    if (etaTrackingRef.current) {
      busyEta.end();
      etaTrackingRef.current = false;
    }
    setBusy(false);
  }, [busyEta]);

  const sendMessage = useCallback(
    async (
      text: string,
      currentStep?: string,
      opts?: { skipOptimistic?: boolean; optimisticId?: string },
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const tone = resolveChatBusyTone({
        currentStep: currentStep ?? session?.currentStep,
        hadOperationError: Boolean(operationErrorRef.current),
      });

      const optimisticId =
        opts?.optimisticId ?? `pending-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (!opts?.skipOptimistic) {
        const optimistic: SerializedMessage = {
          id: optimisticId,
          role: 'user',
          content: trimmed,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
      }

      beginBusy(tone);
      const reconcileSnapshot = captureReconcileSnapshot(session, messages);

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
        if (isNetworkFailure(e)) {
          const recovered = await reconcileSessionAfterNetworkError(
            sessionId,
            reconcileSnapshot,
          );
          if (recovered) {
            applyResult({
              session: recovered,
              messages: recovered.messages ?? [],
            });
            return;
          }
        }
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        const msg = e instanceof Error ? e.message : 'Send failed';
        setOperationError(msg);
        setBusyTone('fixing');
      } finally {
        endBusy();
      }
    },
    [sessionId, session, messages, applyResult, beginBusy, endBusy],
  );

  useEffect(() => {
    if (!hasInitialSend) {
      if (skipLoadAfterHandoffRef.current) {
        skipLoadAfterHandoffRef.current = false;
        return;
      }
      void load();
      return;
    }
    if (initialSendStarted.current) return;
    initialSendStarted.current = true;

    const runPollAndApply = async () => {
      beginBusy('thinking');
      setLoading(false);
      const polled = await pollSessionAfterInitialSend(sessionId, initialText);
      if (polled) {
        setSession(polled);
        setMessages(polled.messages ?? []);
        setOperationError(polled.workflowState?.lastOperationError ?? null);
        clearInitialSendLock(sessionId);
        window.dispatchEvent(new CustomEvent('robust-chats-refresh'));
        endBusy();
        return;
      }
      endBusy();
      clearInitialSendLock(sessionId);
      void sendMessage(initialText, 'intent', {
        skipOptimistic: true,
        optimisticId: initialOptimisticId,
      });
    };

    if (hasInitialSendLock(sessionId)) {
      setMessages((prev) =>
        prev.length > 0
          ? prev
          : [optimisticUserMessage(initialText, initialOptimisticId)],
      );
      void runPollAndApply();
      return;
    }

    setInitialSendLock(sessionId, initialText);

    void sendMessage(initialText, 'intent', {
      skipOptimistic: true,
      optimisticId: initialOptimisticId,
    }).catch(() => {
      clearInitialSendLock(sessionId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount for landing handoff
  }, [hasInitialSend, sessionId, initialText]);

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

      const skipAttachmentTextBubble =
        action === 'imageGen.uploaded' && typeof payload.assetId === 'string' && payload.assetId;
      const skipUserBubble =
        skipAttachmentTextBubble ||
        (Boolean(displayText) && shouldSkipActionUserBubble(messages, action));

      let optimisticId: string | null = null;
      if (!silent && displayText && !skipUserBubble) {
        optimisticId = appendOptimisticUser(displayText);
      }
      if (!silent) beginBusy(tone);
      const reconcileSnapshot = captureReconcileSnapshot(session, messages);

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
        if (isNetworkFailure(e)) {
          const recovered = await reconcileSessionAfterNetworkError(
            sessionId,
            reconcileSnapshot,
          );
          if (recovered) {
            applyResult({
              session: recovered,
              messages: recovered.messages ?? [],
            });
            return;
          }
        }
        if (optimisticId) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
        const msg = e instanceof Error ? e.message : 'Action failed';
        setOperationError(msg);
        setBusyTone('fixing');
      } finally {
        if (!silent) endBusy();
      }
    },
    [sessionId, session, messages, applyResult, beginBusy, endBusy, appendOptimisticUser],
  );

  return {
    session,
    messages,
    loading,
    busy,
    busyTone,
    busyEtaSuffix: busyEta.etaSuffix,
    showSavedEta: busyEta.showSaved,
    savedEtaMessage: busyEta.savedMessage,
    error,
    operationError,
    load,
    sendMessage,
    dispatchAction,
    setError,
  };
}
