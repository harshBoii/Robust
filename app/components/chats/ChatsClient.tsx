'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';

import type { SerializedMessage } from '@/lib/chats/types';

import { ChatWidgetRenderer } from './ChatWidgetRenderer';
import { ChatsThread, type ThreadMessage } from './ChatsThread';
import { composerSuggestions as agentComposerSuggestions } from '@/lib/chats/composer-suggestions';
import { getBackStepOptions } from '@/lib/chats/workflow-navigation';
import type { ChatWorkflowStep, WorkflowState } from '@/lib/chats/types';

import { useChatSession } from './useChatSession';

function stepSuggestions(
  step: string | undefined,
  workflowState: WorkflowState,
): string[] | undefined {
  const back = step
    ? getBackStepOptions(step as ChatWorkflowStep, workflowState).map((o) => o.label)
    : [];

  const base = agentComposerSuggestions(step, workflowState);

  if (!base && back.length === 0) return undefined;
  const merged = [...(back.length ? ['Go back'] : []), ...(base ?? [])];
  return merged.length ? merged : undefined;
}

export default function ChatsClient({
  sessionId,
  companyId,
  userName: _userName,
}: {
  sessionId: string;
  companyId: string;
  userName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useChatSession(sessionId);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction = useCallback(
    async (action: string, payload?: Record<string, unknown>, userMessage?: string) => {
      await dispatchAction(action, payload ?? {}, session?.currentStep, userMessage);
    },
    [dispatchAction, session?.currentStep],
  );

  const threadMessages: ThreadMessage[] = messages.map((m: SerializedMessage) => ({
    id: m.id,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content ?? undefined,
    children:
      m.role !== 'user' && m.widgetType ? (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
          <ChatWidgetRenderer
            widgetType={m.widgetType}
            widgetPayload={m.widgetPayload}
            workflowState={session?.workflowState ?? {}}
            currentStep={session?.currentStep ?? 'intent'}
            companyId={companyId}
            sessionId={sessionId}
            onAction={handleAction}
          />
        </div>
      ) : undefined,
  }));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/20 bg-background/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <h1 className="truncate font-display text-[15px] font-semibold text-foreground">
            {session?.title ?? 'New chat'}
          </h1>
          <Link
            href="/chats"
            className="shrink-0 rounded-lg px-2.5 py-1 text-[12px] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
          >
            New chat
          </Link>
        </div>
      </header>

      {error && !operationError ? (
        <div className="mx-auto mt-2 max-w-3xl rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,video/*"
        onChange={() => {
          /* upload handled inside MediaUploadWidget when visible */
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatsThread
          messages={threadMessages}
          loading={busy}
          operationError={operationError}
          busyTone={busyTone}
          composer={{
            onSend: (text) => {
              const trimmed = text.trim();
              const backOpts = getBackStepOptions(
                (session?.currentStep ?? 'intent') as ChatWorkflowStep,
                session?.workflowState ?? {},
              );
              const backHit = backOpts.find((o) => o.label === trimmed);
              if (backHit) {
                void dispatchAction(
                  'workflow.goBack',
                  { step: backHit.step, label: backHit.label },
                  session?.currentStep,
                  backHit.label,
                );
                return;
              }
              if (trimmed === 'Go back') {
                void dispatchAction('workflow.goBack', {}, session?.currentStep, 'Go back');
                return;
              }
              void sendMessage(text, session?.currentStep);
            },
            onAttach: () => fileRef.current?.click(),
            loading: busy,
            disabled: busy || session?.status === 'COMPLETED',
            placeholder: 'Write a message…',
            suggestions: stepSuggestions(session?.currentStep, session?.workflowState ?? {}),
            sticky: true,
          }}
        />
      </div>
    </div>
  );
}
