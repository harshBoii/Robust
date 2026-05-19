'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import type { ChatBusyTone } from './chat-busy-tone';
import { CHAT_FIXING_STATUS_MESSAGES } from './chat-fixing-status-messages';
import { CHAT_ASSISTANT_STATUS_MESSAGES } from './chat-status-messages';
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
}: {
  messages: ThreadMessage[];
  composer: ChatsComposerProps;
  emptyState?: ReactNode;
  loading?: boolean;
  operationError?: string | null;
  busyTone?: ChatBusyTone;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const showEmpty = messages.length === 0 && emptyState;
  const hasOperationError = Boolean(operationError?.trim());
  const isFixing = busyTone === 'fixing' || hasOperationError;
  const statusPool = isFixing ? CHAT_FIXING_STATUS_MESSAGES : CHAT_ASSISTANT_STATUS_MESSAGES;
  const statusActive = Boolean(loading);
  const statusText = useRotatingStatus(statusPool, statusActive);
  const showStatusPanel = Boolean(loading || hasOperationError);
  const statusLabel = loading ? (isFixing ? 'Fixing…' : 'Thinking…') : isFixing ? 'Fixing…' : undefined;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, statusText, operationError]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-4">
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

      <footer className="sticky bottom-0 z-20 shrink-0 relative">
        <div
          className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background via-background/90 to-transparent"
          aria-hidden
        />
        <div className="relative border-t border-border/15 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <ChatsComposer {...composer} sticky />
        </div>
      </footer>
    </div>
  );
}
