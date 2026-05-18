'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AiOutlineLoading } from 'react-icons/ai';

import { RobustaChatMessage, type ChatMessageItem } from './RobustaChatMessage';

export type QuickReply = { id: string; label: string };

export function RobustaChatShell({
  messages,
  onSend,
  loading,
  quickReplies,
  inputPlaceholder = 'Message Miss Robusta…',
  disabled,
  headerBanner,
}: {
  messages: ChatMessageItem[];
  onSend: (text: string) => void;
  loading?: boolean;
  quickReplies?: QuickReply[];
  inputPlaceholder?: string;
  disabled?: boolean;
  headerBanner?: ReactNode;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || disabled) return;
    onSend(trimmed);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {headerBanner ? <div className="shrink-0 px-1 pb-2">{headerBanner}</div> : null}

      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
        {messages.map((msg) => (
          <RobustaChatMessage key={msg.id} message={msg} />
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' ? (
          <RobustaChatMessage
            message={{
              id: 'typing',
              role: 'assistant',
              content: '',
              streaming: true,
            }}
          />
        ) : null}
        <div ref={bottomRef} />
      </div>

      {quickReplies && quickReplies.length > 0 && !loading && !disabled ? (
        <div className="shrink-0 border-t border-border/30 px-1 py-2">
          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => handleSend(q.label)}
                className="rounded-full bg-clipfox-primary/10 px-2.5 py-1 text-[11px] font-medium text-clipfox-primary hover:bg-clipfox-primary/20"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-border/40 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            disabled={disabled || loading}
            className="glass-input custom-scrollbar max-h-24 flex-1 resize-none py-2.5 pl-3 pr-2 text-sm leading-snug"
            placeholder={inputPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            disabled={!input.trim() || loading || disabled}
            onClick={() => handleSend(input)}
            className="glass-button-primary shrink-0 rounded-xl p-2.5 disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? (
              <AiOutlineLoading className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground/50">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}
