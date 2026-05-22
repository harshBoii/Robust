'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

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
};

function ThinkingPanel({
  statusText,
  errorDetail,
  statusLabel = 'Thinking…',
  showThinkingDots = true,
}: {
  statusText?: string;
  errorDetail?: string | null;
  statusLabel?: string;
  showThinkingDots?: boolean;
}) {
  const [errorOpen, setErrorOpen] = useState(false);
  const hasError = Boolean(errorDetail?.trim());

  return (
    <div className="space-y-2 py-1">
      {statusLabel ? (
        <p className="text-[13px] font-medium text-muted-foreground">
          {statusLabel}
        </p>
      ) : null}
      {statusText ? (
        <p className="text-[14px] italic leading-snug text-muted-foreground">{statusText}</p>
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
        />
      ) : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
