'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import type { WorkflowState } from '@/lib/chats/types';
import {
  resolveChatStatusLabel,
  resolveChatStatusMessages,
} from '@/lib/chats/resolve-status-messages';

import type { ChatBusyTone } from './chat-busy-tone';
import { ChatsComposer, type ChatsComposerProps } from './ChatsComposer';
import { ChatsMessage, type ChatsMessageProps } from './ChatsMessage';
import { useRotatingStatus } from './useRotatingStatus';

export type ThreadMessage = ChatsMessageProps;

export function ChatsThread({
  messages,
  composer,
  emptyState,
  loading,
  operationError,
  busyTone = 'thinking',
  currentStep = 'intent',
  workflowState = {},
}: {
  messages: ThreadMessage[];
  composer: ChatsComposerProps;
  emptyState?: ReactNode;
  loading?: boolean;
  operationError?: string | null;
  busyTone?: ChatBusyTone;
  currentStep?: string;
  workflowState?: WorkflowState;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const showEmpty = messages.length === 0 && emptyState;
  const hasOperationError = Boolean(operationError?.trim());
  const effectiveTone: ChatBusyTone =
    busyTone === 'fixing' || hasOperationError ? 'fixing' : busyTone;
  const statusCtx = {
    busyTone: effectiveTone,
    currentStep,
    workflowState,
  };
  const statusPool = resolveChatStatusMessages(statusCtx);
  const statusActive = Boolean(loading);
  const statusText = useRotatingStatus(statusPool, statusActive);
  const showStatusPanel = Boolean(loading || hasOperationError);
  const statusLabel = loading
    ? resolveChatStatusLabel(statusCtx)
    : hasOperationError
      ? 'Fixing…'
      : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading, statusText, operationError]);

  return (
    <div className="relative grid h-full min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background">
      <div
        className="custom-scrollbar min-h-0 overflow-y-auto overscroll-contain"
        role="log"
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-6">
          {showEmpty ? emptyState : null}
          {messages.map((m) => (
            <ChatsMessage key={m.id} {...m} />
          ))}
          {showStatusPanel ? (
            <ChatsMessage
              id="operation-status"
              role="assistant"
              streaming={loading}
              statusText={loading ? (statusText ?? undefined) : undefined}
              errorDetail={operationError ?? undefined}
              statusLabel={statusLabel}
              showThinkingDots={loading}
            />
          ) : null}
          <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
        </div>
      </div>

      <footer className="relative z-20 shrink-0 border-t border-border/15 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background via-background/90 to-transparent"
          aria-hidden
        />
        <ChatsComposer {...composer} sticky />
      </footer>
    </div>
  );
}
