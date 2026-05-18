'use client';

import ReactMarkdown from 'react-markdown';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
      ))}
    </span>
  );
}

export function MarkdownMessage({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  if (!content) {
    return isStreaming ? <TypingDots /> : null;
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-sm font-semibold text-clipfox-primary first:mt-0">
              {children}
            </h2>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-clipfox-primary">{children}</strong>
          ),
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming ? (
        <span className="ml-1 inline-block h-3.5 w-px align-middle rounded-full bg-current opacity-50" />
      ) : null}
    </div>
  );
}
