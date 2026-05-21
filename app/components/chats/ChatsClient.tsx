'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SerializedMessage } from '@/lib/chats/types';

import { resolveInitialHandoffText } from './resolve-initial-handoff-text';
import { ChatMessageMediaPreview, messageHasMediaPreview } from './ChatMessageMediaPreview';
import { ChatWidgetRenderer } from './ChatWidgetRenderer';
import { CHAT_COMPOSER_LAYOUT_ID } from './ChatsRouteTransition';
import { ChatsThread, type ThreadMessage } from './ChatsThread';
import { composerSuggestions as agentComposerSuggestions } from '@/lib/chats/composer-suggestions';
import { getBackStepOptions } from '@/lib/chats/workflow-navigation';
import type { ChatWorkflowStep, WorkflowState } from '@/lib/chats/types';

import { ImageGenArtistSettingsBar } from './ImageGenArtistSettingsBar';
import { useChatSession } from './useChatSession';
import {
  DEFAULT_IMAGE_ARTIST_ID,
  DEFAULT_IMAGE_QUALITY,
  IMAGE_ARTISTS,
  type ImageArtistId,
  type ImageQuality,
} from '@/lib/image-gen/image-artists';

const ease = [0.22, 1, 0.36, 1] as const;

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
  const initialHandoffText = resolveInitialHandoffText(sessionId);

  const {
    session,
    messages,
    loading,
    busy,
    busyTone,
    error,
    operationError,
    sendMessage,
    dispatchAction,
  } = useChatSession(sessionId, {
    initialMessage: initialHandoffText || null,
    initialTitle: initialHandoffText.slice(0, 80) || null,
  });

  const handleAction = useCallback(
    async (action: string, payload?: Record<string, unknown>, userMessage?: string) => {
      await dispatchAction(action, payload ?? {}, session?.currentStep, userMessage);
    },
    [dispatchAction, session?.currentStep],
  );

  const ig = session?.workflowState?.imageGen;
  const showImageGenArtistBar =
    session?.currentStep === 'imageGen' && ig?.step === 'artistSettings';

  const [composerArtistId, setComposerArtistId] = useState<ImageArtistId>(DEFAULT_IMAGE_ARTIST_ID);
  const [composerQuality, setComposerQuality] = useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);

  useEffect(() => {
    if (!showImageGenArtistBar) return;
    setComposerArtistId((ig?.imageArtistId as ImageArtistId) ?? DEFAULT_IMAGE_ARTIST_ID);
    setComposerQuality((ig?.imageQuality as ImageQuality) ?? DEFAULT_IMAGE_QUALITY);
  }, [showImageGenArtistBar, ig?.imageArtistId, ig?.imageQuality]);

  const submitArtistSettings = useCallback(() => {
    const artist = IMAGE_ARTISTS.find((a) => a.id === composerArtistId);
    void handleAction(
      'imageGen.artistSettings',
      { artistId: composerArtistId, quality: composerQuality },
      `${artist?.name ?? 'Artist'} · ${composerQuality} quality`,
    );
  }, [composerArtistId, composerQuality, handleAction]);

  const latestWidgetMessageId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'user' && m.widgetType) return m.id;
    }
    return null;
  })();

  const threadMessages: ThreadMessage[] = messages.map((m: SerializedMessage) => {
    const isLatestWidget =
      m.role !== 'user' && Boolean(m.widgetType) && m.id === latestWidgetMessageId;
    const showMediaPreview =
      m.role !== 'user' &&
      messageHasMediaPreview(m.widgetType, m.widgetPayload) &&
      !isLatestWidget;

    if (!isLatestWidget && !showMediaPreview) {
      return {
        id: m.id,
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content ?? undefined,
      };
    }

    return {
      id: m.id,
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content ?? undefined,
      children: (
        <div className="space-y-2">
          {showMediaPreview ? (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
              <ChatMessageMediaPreview
                widgetType={m.widgetType}
                widgetPayload={m.widgetPayload}
              />
            </div>
          ) : null}
          {isLatestWidget ? (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
              <ChatWidgetRenderer
                widgetType={m.widgetType}
                widgetPayload={m.widgetPayload}
                workflowState={session?.workflowState ?? {}}
                currentStep={session?.currentStep ?? 'intent'}
                imageGenArtistInComposer={showImageGenArtistBar}
                companyId={companyId}
                sessionId={sessionId}
                onAction={handleAction}
              />
            </div>
          ) : null}
        </div>
      ),
    };
  });

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
        Loading conversation…
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease }}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.06, ease }}
        className="shrink-0 border-b border-border/20 bg-background/80 px-4 py-2.5 backdrop-blur-sm"
      >
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
      </motion.header>

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
          currentStep={session?.currentStep ?? 'intent'}
          workflowState={session?.workflowState ?? {}}
          composerLayoutId={CHAT_COMPOSER_LAYOUT_ID}
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
            leadingSlot: showImageGenArtistBar ? (
              <ImageGenArtistSettingsBar
                compact
                disabled={busy}
                artistId={composerArtistId}
                quality={composerQuality}
                onArtistChange={setComposerArtistId}
                onQualityChange={setComposerQuality}
                onContinue={submitArtistSettings}
              />
            ) : undefined,
            sticky: true,
          }}
        />
      </div>
    </motion.div>
  );
}
