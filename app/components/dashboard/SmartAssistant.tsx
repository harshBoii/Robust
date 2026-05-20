'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  HiOutlineChartBarSquare,
  HiOutlineCurrencyDollar,
  HiOutlineFilm,
  HiOutlineLightBulb,
  HiOutlinePauseCircle,
  HiOutlineRocketLaunch,
} from 'react-icons/hi2';
import { AiOutlineLoading } from 'react-icons/ai';

import { buildAssistantContext } from '@/lib/dashboard/assistant-context';

type RuleType =
  | 'AUTO_PAUSE'
  | 'FATIGUE_ALERT'
  | 'BUDGET_PACING'
  | 'SPEND_CONCENTRATION'
  | 'WINNER_AMPLIFICATION';

export type Rule = {
  ruleType: RuleType;
  isEnabled: boolean;
  threshold: number | null;
  window: number | null;
  requiresApproval: boolean;
};

export type AssistantRow = {
  adId: string;
  name: string;
  status: string | null;
  spendToday: number;
  spendTotal: number;
  cpi: number | null;
  ctr: number;
  hookRate: number | null;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm Miss Robusta — your Meta Ads analyst. Ask me anything about your campaigns — which ads to pause, scale, or refresh.",
};

function buildContext(rows: AssistantRow[]) {
  return buildAssistantContext(
    rows.map((r) => ({
      adId: r.adId,
      name: r.name,
      status: r.status,
      thumbnailUrl: null,
      spendToday: r.spendToday,
      spendTotal: r.spendTotal,
      cpi: r.cpi,
      ctr: r.ctr,
      hookRate: r.hookRate,
      statusSignal: null,
    })),
  );
}

/* ── Typing indicator (static — no bounce) ── */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-40"
        />
      ))}
    </span>
  );
}

/* ── Avatar ── */
function RobustaAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 36 : 24;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full shadow-sm"
      style={{ width: dim, height: dim }}
    >
      <Image
        src="/mascot/Robust.png"
        alt="Miss Robusta"
        width={dim}
        height={dim}
        className="h-full w-full object-cover"
        unoptimized
      />
    </div>
  );
}

/* ── Quick Suggestions ── */
const QUICK_SUGGESTIONS = [
  {
    id: 'ideas',
    Icon: HiOutlineLightBulb,
    label: 'Give me ideas to win',
    prompt: 'Give me ideas to improve my ad performance and win more customers',
  },
  {
    id: 'summary',
    Icon: HiOutlineChartBarSquare,
    label: 'Summarise all info',
    prompt: 'Summarize all my current ad performance data and key metrics',
  },
  {
    id: 'pause',
    Icon: HiOutlinePauseCircle,
    label: 'Which ads to pause',
    prompt: 'Which ads should I pause right now and why',
  },
  {
    id: 'scale',
    Icon: HiOutlineRocketLaunch,
    label: 'What to scale',
    prompt: 'Which ads are winners that I should scale up',
  },
  {
    id: 'budget',
    Icon: HiOutlineCurrencyDollar,
    label: 'Budget tips',
    prompt: 'Give me budget optimization tips for my current campaigns',
  },
  {
    id: 'hook',
    Icon: HiOutlineFilm,
    label: 'Hook rate analysis',
    prompt: 'Analyze my hook rates and tell me which creatives are grabbing attention',
  },
] as const;

/* ── Markdown Message Renderer ── */
function MarkdownMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  if (!content) {
    return isStreaming ? <TypingDots /> : null;
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-clipfox-primary">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-clipfox-primary">{children}</strong>,
          em: ({ children }) => <em className="italic opacity-90">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          code: ({ children }) => (
            <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="bg-black/5 dark:bg-white/5 p-2 rounded-lg overflow-x-auto text-xs my-2">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-clipfox-primary pl-3 italic opacity-80 my-2">{children}</blockquote>
          ),
          hr: () => <hr className="my-3 border-border/50" />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-clipfox-primary underline hover:opacity-80">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-1 inline-block h-3.5 w-px rounded-full bg-current opacity-50 align-middle" />
      )}
    </div>
  );
}

export default function SmartAssistant({
  rows,
  rules: _rules,
  onPauseAd: _onPauseAd,
  onRefresh: _onRefresh,
}: {
  rows: AssistantRow[];
  rules: Rule[];
  onPauseAd: (adId: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* focus input when panel opens */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ]);
    setInput('');
    setStreaming(true);

    // Build the history to send (exclude streaming placeholder)
    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: trimmed });

    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: history, context: buildContext(rows) }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: snap, streaming: true } : m,
          ),
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m,
        ),
      );
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">

      {/* ── Chat Panel ── */}
      {open && (
        <div className="glass-card-elevated flex h-[520px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
            <RobustaAvatar size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Miss Robusta</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Meta Ads Analyst · {rows.length} ads loaded
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="glass-button p-1.5"
              aria-label="Close"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {msg.role === 'assistant' && <RobustaAvatar />}

                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'glass-button-primary ml-auto rounded-br-sm text-white'
                      : 'glass-card rounded-bl-sm text-foreground',
                  ].join(' ')}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownMessage content={msg.content} isStreaming={msg.streaming} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick Suggestions */}
          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !streaming && (
            <div className="border-t border-border/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5 font-medium">
                Quick Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTIONS.map(({ id, Icon, label, prompt }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-clipfox-primary/10 px-2.5 py-1.5 text-left text-[11px] font-medium text-clipfox-primary transition-colors hover:bg-clipfox-primary/20"
                  >
                    <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border/40 px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                className="glass-input custom-scrollbar flex-1 resize-none py-2.5 pl-3.5 pr-2 text-sm leading-snug"
                placeholder="Ask Miss Robusta anything…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ maxHeight: 96 }}
                disabled={streaming}
              />
              <button
                type="button"
                disabled={!input.trim() || streaming}
                onClick={() => void send(input)}
                className="glass-button-primary shrink-0 rounded-xl p-2.5 disabled:opacity-40"
                aria-label="Send"
              >
                {streaming ? (
                  <AiOutlineLoading className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center font-ui text-[10px] text-muted-foreground/50">
              Shift+Enter for new line · Enter to send
            </p>
          </div>
        </div>
      )}

      {/* ── FAB toggle button ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'group relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300',
          'glass-button-primary ring-4 ring-clipfox-primary/20 hover:ring-clipfox-primary/40',
          open ? 'rotate-0' : '',
        ].join(' ')}
        aria-label="Open Miss Robusta"
      >
        {open ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <Image
            src="/mascot/Robust.png"
            alt="Miss Robusta"
            width={40}
            height={40}
            className="h-full w-full rounded-full object-cover"
            unoptimized
          />
        )}
      </button>
    </div>
  );
}
