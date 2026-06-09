'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface IntelligenceSummaryProps {
  markdown: string;
  brandName: string;
}

export default function IntelligenceSummary({ markdown, brandName }: IntelligenceSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[var(--card)] shadow-md">
      {/* Header — always visible, click to toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--sibling-primary)]/20">
            <Brain className="h-4 w-4 text-[var(--sibling-primary)]" />
          </span>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">
              Competitive Intelligence — {brandName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              GPT-4 Vision summary of top 6 ads
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-white/10 px-5 py-5">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-2 mt-5 border-b border-white/10 pb-1.5 text-base font-bold first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-1.5 mt-4 text-sm font-semibold text-[var(--sibling-primary)] first:mt-0">
                    {children}
                  </h2>
                ),
                p: ({ children }) => (
                  <p className="mb-2 text-sm leading-relaxed text-foreground/90">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-3 list-disc space-y-1 pl-4 text-sm">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="leading-snug text-foreground/80">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
