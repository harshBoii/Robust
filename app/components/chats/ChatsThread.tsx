'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

import type { WorkflowState } from '@/lib/chats/types';
import {
  resolveChatStatusLabel,
  resolveChatStatusMessages,
} from '@/lib/chats/resolve-status-messages';
import { isAutoAdsBusy } from '@/lib/chats/auto-ads/milestones';

import type { ChatBusyTone } from './chat-busy-tone';
import { AutoPipelineMilestones } from './AutoPipelineMilestones';
import { ChatsComposer, type ChatsComposerProps } from './ChatsComposer';
import { ChatsMessage, type ChatsMessageProps } from './ChatsMessage';
import { useRotatingStatus } from './useRotatingStatus';

export type ThreadMessage = ChatsMessageProps;

const IMAGE_GEN_GENERATING_STEPS = new Set([
  'generateBase',
  'generateOnModel',
  'generateVariants',
  'generateIdeas',
  'generateTemplate',
]);

const VIDEO_GEN_BUSY_STEPS = new Set([
  'generatingScript',
  'fetchTopAds',
  'analyzingAds',
  'runningIntel',
  'heygenGenerating',
  'heygenPolling',
]);

const statusEase = [0.22, 1, 0.36, 1] as const;

export function ChatsThread({
  messages,
  composer,
  emptyState,
  loading,
  operationError,
  busyTone = 'thinking',
  busyEtaSuffix,
  showSavedEta = false,
  savedEtaMessage,
  currentStep = 'intent',
  workflowState = {},
}: {
  messages: ThreadMessage[];
  composer: ChatsComposerProps;
  emptyState?: ReactNode;
  loading?: boolean;
  operationError?: string | null;
  busyTone?: ChatBusyTone;
  /** Live countdown e.g. "~1:45" beside the thinking label */
  busyEtaSuffix?: string | null;
  showSavedEta?: boolean;
  savedEtaMessage?: string | null;
  currentStep?: string;
  workflowState?: WorkflowState;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef(0);
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
  const statusActive = Boolean(loading) && !showSavedEta;
  const rotatingStatus = useRotatingStatus(statusPool, statusActive);
  const imageGenGenerating = Boolean(
    workflowState.imageGen?.step &&
      IMAGE_GEN_GENERATING_STEPS.has(workflowState.imageGen.step),
  );
  const videoGenBusy = Boolean(
    workflowState.videoGen?.step && VIDEO_GEN_BUSY_STEPS.has(workflowState.videoGen.step),
  );
  const showAutoMilestones = isAutoAdsBusy(workflowState) && !showSavedEta;
  const showThinkingPanel = Boolean(
    hasOperationError || (loading && !showSavedEta && !imageGenGenerating && !videoGenBusy),
  );
  const baseStatusLabel = loading
    ? resolveChatStatusLabel(statusCtx)
    : hasOperationError
      ? 'Fixing…'
      : undefined;
  const statusLabel = showSavedEta ? 'Done!' : baseStatusLabel;
  const statusEtaSuffix =
    !showSavedEta && loading && busyEtaSuffix && effectiveTone === 'thinking'
      ? busyEtaSuffix
      : undefined;
  const statusText = showSavedEta && savedEtaMessage ? savedEtaMessage : rotatingStatus;
  const showThinkingDots = Boolean(loading) && !showSavedEta;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length <= lastMessageCount.current) return;
    lastMessageCount.current = messages.length;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div
        ref={scrollRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-4">
          {showEmpty ? emptyState : null}
          {messages.map((m) => (
            <ChatsMessage key={m.id} {...m} />
          ))}
          <AnimatePresence initial={false}>
            {showSavedEta ? (
              <motion.div
                key="saved-eta"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.38, ease: statusEase }}
              >
                <ChatsMessage
                  id="operation-status-saved"
                  role="assistant"
                  streaming
                  statusText={statusText ?? undefined}
                  statusTextSaved
                  statusLabelBold
                  statusLabel="Done!"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          {showAutoMilestones ? (
            <div className="mb-4">
              <AutoPipelineMilestones workflowState={workflowState} />
            </div>
          ) : null}
          {showThinkingPanel ? (
            <ChatsMessage
              id="operation-status"
              role="assistant"
              streaming={loading}
              statusText={statusText ?? undefined}
              errorDetail={operationError ?? undefined}
              statusLabel={statusLabel}
              statusEtaSuffix={statusEtaSuffix}
              showThinkingDots={showThinkingDots}
            />
          ) : null}
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
