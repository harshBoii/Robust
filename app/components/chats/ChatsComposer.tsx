'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, ArrowUp } from 'lucide-react';

export type ChatsComposerProps = {
  value?: string;
  onChange?: (value: string) => void;
  onSend: (text: string) => void;
  onAttach?: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  modelLabel?: string;
  /** Claude-style controls left of send (e.g. image artist / quality). */
  leadingSlot?: ReactNode;
  /** Thumbnails above the text area (pending uploads). */
  attachmentSlot?: ReactNode;
  suggestions?: string[];
  /** Tighter padding when pinned to the bottom of the thread */
  sticky?: boolean;
  /** Compact footer widget (e.g. image artist picker) instead of the full message box */
  pickerMode?: {
    title: string;
    description?: string;
    children: ReactNode;
  };
};

export function ChatsComposer({
  value: controlledValue,
  onChange,
  onSend,
  onAttach,
  placeholder = 'Write a message…',
  disabled,
  loading,
  modelLabel = 'Miss Robusta',
  leadingSlot,
  attachmentSlot,
  suggestions,
  sticky = false,
  pickerMode,
}: ChatsComposerProps) {
  const [internal, setInternal] = useState('');
  const value = controlledValue ?? internal;
  const setValue = onChange ?? setInternal;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || loading) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  const canSend = Boolean(value.trim()) && !disabled && !loading;

  if (pickerMode) {
    return (
      <div className={['w-full shrink-0 px-4', sticky ? 'pb-3 pt-2' : 'pb-5 pt-2'].join(' ')}>
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border border-border/50 bg-card/90 px-4 py-3.5 shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] backdrop-blur-md">
            <p className="text-center text-[14px] font-semibold text-foreground">{pickerMode.title}</p>
            {pickerMode.description ? (
              <p className="mt-1 text-center text-[12px] leading-snug text-muted-foreground">
                {pickerMode.description}
              </p>
            ) : null}
            <div className="mt-3">{pickerMode.children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={['w-full shrink-0 px-4', sticky ? 'pb-3 pt-2' : 'pb-5 pt-2'].join(' ')}>
      {suggestions && suggestions.length > 0 && !disabled ? (
        <div className="mx-auto mb-3 flex max-w-3xl flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              className="rounded-full border border-border/40 bg-background/60 px-3.5 py-1.5 text-[13px] text-foreground/80 transition hover:border-border hover:bg-background hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl">
        <div
          className={[
            'relative flex flex-col rounded-[1.25rem] border border-border/50 bg-card/80 shadow-lg shadow-black/[0.04] backdrop-blur-md',
            'ring-1 ring-black/[0.03] transition-shadow focus-within:border-border focus-within:shadow-xl focus-within:ring-primary/10',
            disabled ? 'opacity-60' : '',
          ].join(' ')}
        >
          {attachmentSlot}

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled || loading}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="custom-scrollbar w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={onAttach}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
                aria-label="Attach"
              >
                <Plus className="h-5 w-5" strokeWidth={1.75} />
              </button>
              {leadingSlot ? (
                <div className="flex min-w-0 flex-wrap items-center gap-0.5 border-l border-border/40 pl-1">
                  {leadingSlot}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!leadingSlot ? (
                <span className="hidden text-[12px] text-muted-foreground/70 sm:inline">{modelLabel}</span>
              ) : null}
              <button
                type="button"
                disabled={!canSend}
                onClick={submit}
                aria-label="Send message"
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl transition',
                  canSend
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'bg-muted/80 text-muted-foreground/40',
                ].join(' ')}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground/45">
          Miss Robusta can make mistakes. Double-check campaign and adset settings before publishing.
        </p>
      </div>
    </div>
  );
}
