'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Clock } from 'lucide-react';

import { MarkdownMessage } from '@/app/components/assistant/MarkdownMessage';

export type ChatsMessageProps = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  children?: ReactNode;
  streaming?: boolean;
  /** Rotating status line while waiting. */
  statusText?: string;
  /** Meta/create error — only shown in collapsible under thinking/status. */
  errorDetail?: string | null;
  /** Panel title above the status line. */
  statusLabel?: string;
  /** Bounce dots while a request is in flight (off when only showing a persisted error). */
  showThinkingDots?: boolean;
  /** Green accent for early-finish ETA message. */
  statusTextSaved?: boolean;
  /** Bold label (e.g. "Done!" after early finish). */
  statusLabelBold?: boolean;
  /** Live ETA countdown beside the status label. */
  statusEtaSuffix?: string;
  /** Inline chips shown below the assistant bubble (e.g. intent clarification). */
  suggestionChips?: string[];
  onSuggestionClick?: (text: string) => void;
};

function ThinkingPanel({
  statusText,
  errorDetail,
  statusLabel,
  showThinkingDots = true,
  statusTextSaved = false,
  statusLabelBold = false,
  statusEtaSuffix,
}: {
  statusText?: string;
  errorDetail?: string | null;
  statusLabel?: string;
  showThinkingDots?: boolean;
  statusTextSaved?: boolean;
  statusLabelBold?: boolean;
  statusEtaSuffix?: string;
}) {
  const [errorOpen, setErrorOpen] = useState(false);
  const hasError = Boolean(errorDetail?.trim());

  return (
    <div className="space-y-2 py-1">
      {statusLabel || statusEtaSuffix ? (
        <p className="text-[13px] leading-snug">
          {statusLabel ? (
            <span
              className={
                statusLabelBold
                  ? 'font-bold text-foreground'
                  : 'font-medium text-muted-foreground'
              }
            >
              {statusLabel}
            </span>
          ) : null}
          {statusLabel && statusEtaSuffix ? (
            <span className="font-medium text-muted-foreground"> · </span>
          ) : null}
          {statusEtaSuffix ? (
            <span className="inline-flex items-center gap-1 italic text-primary">
              <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {statusEtaSuffix}
            </span>
          ) : null}
        </p>
      ) : null}
      {statusText ? (
        <p
          className={[
            'text-[14px] leading-snug',
            statusTextSaved
              ? 'font-medium text-emerald-600 dark:text-emerald-400'
              : 'italic text-muted-foreground',
          ].join(' ')}
        >
          {statusText}
        </p>
      ) : null}
      {showThinkingDots ? (
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
        </div>
      ) : null}
      {hasError ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setErrorOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-2.5 py-1.5 text-left text-[12px] font-medium text-destructive transition hover:bg-destructive/10"
          >
            <ChevronDown
              className={['h-3.5 w-3.5 shrink-0 transition', errorOpen ? 'rotate-180' : ''].join(' ')}
            />
            Error details
          </button>
          {errorOpen ? (
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 font-mono text-[11px] leading-relaxed text-destructive/90">
              {errorDetail}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** User bubbles (contrasting bg); assistant as plain prose without branding. */
export function ChatsMessage({
  role,
  content,
  children,
  streaming,
  statusText,
  errorDetail,
  statusLabel,
  showThinkingDots,
  statusTextSaved,
  statusLabelBold,
  statusEtaSuffix,
  suggestionChips,
  onSuggestionClick,
}: ChatsMessageProps) {
  if (role === 'user') {
    if (children) {
      return <div className="py-2">{children}</div>;
    }
    return (
      <div className="flex justify-end py-2">
        <div
          className={[
            'max-w-[min(85%,32rem)] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed',
            'border border-[color-mix(in_srgb,var(--primary)_22%,var(--border))]',
            'bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))]',
            'text-foreground shadow-sm',
          ].join(' ')}
        >
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </div>
    );
  }

  return (
    <article className="py-4">
      {content ? (
        <div className="text-[15px] leading-[1.65] text-foreground/95 [&_p]:mb-3 [&_p:last-child]:mb-0">
          <MarkdownMessage content={content} isStreaming={streaming} />
        </div>
      ) : streaming || errorDetail ? (
        <ThinkingPanel
          statusText={statusText}
          errorDetail={errorDetail}
          statusLabel={statusLabel}
          showThinkingDots={showThinkingDots ?? streaming}
          statusTextSaved={statusTextSaved}
          statusLabelBold={statusLabelBold}
          statusEtaSuffix={statusEtaSuffix}
        />
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
      {suggestionChips && suggestionChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestionChips.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSuggestionClick?.(s)}
              className="rounded-full border border-border/40 bg-background/60 px-3.5 py-1.5 text-[13px] text-foreground/80 transition hover:border-border hover:bg-background hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
