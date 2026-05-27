'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

type CitationCompany = { name: string; rank: number | null };

export type CitationRow = {
  id: string;
  prompt: string;
  model: string;
  rank: number | null;
  type: string;
  companies: CitationCompany[];
  companyName?: string | null;
};

export function CitationsTable({
  citations,
  ourCompanyName,
}: {
  citations: CitationRow[];
  ourCompanyName: string;
}) {
  const [selected, setSelected] = useState<CitationRow | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [selected]);

  if (!citations.length) {
    return <p className="mt-4 text-xs text-muted-foreground">No citation history yet.</p>;
  }

  const modal = selected
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col border border-[var(--glass-border)]/80 shadow-2xl bg-background/95 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--glass-border)]/80">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-foreground leading-snug">{selected.prompt}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {selected.companyName ? (
                    <span className="inline-flex items-center rounded-full border border-[var(--sibling-primary)]/35 bg-[color-mix(in_srgb,var(--sibling-primary)_14%,transparent)] px-2 py-0.5 font-semibold text-[var(--sibling-primary)]">
                      {selected.companyName}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {selected.model}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[var(--glass)]/80 border border-[var(--glass-border)] px-2 py-0.5 font-medium text-muted-foreground">
                    {selected.type}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-full hover:bg-[var(--glass-hover)] text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto glass-scrollbar">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Your rank in this prompt</span>
                <span className="text-lg font-semibold text-foreground tabular-nums">
                  {selected.rank != null ? `#${selected.rank}` : '—'}
                </span>
              </div>

              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-2">
                  All mentioned companies ({selected.companies.length})
                </p>
                <div className="rounded-lg border border-[var(--glass-border)]/70 overflow-hidden">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-3 py-1.5 bg-[var(--glass)]/70 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span>Rank</span>
                    <span>Company</span>
                  </div>
                  <div className="divide-y divide-[var(--glass-border)]/50">
                    {selected.companies.map((comp, idx) => {
                      const isUs = comp.name.toLowerCase() === ourCompanyName.toLowerCase();
                      return (
                        <div
                          key={`${comp.name}-${idx}`}
                          className={`grid grid-cols-[auto_minmax(0,1fr)] gap-4 px-3 py-2 text-xs ${isUs ? 'bg-primary/8' : ''}`}
                        >
                          <span className="w-8 text-center font-semibold tabular-nums text-foreground">
                            {comp.rank != null ? `#${comp.rank}` : '—'}
                          </span>
                          <span className={`font-medium ${isUs ? 'text-primary' : 'text-foreground'}`}>
                            {comp.name}
                            {isUs && <span className="ml-1.5 text-[10px] text-primary/70">(You)</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div className="mt-3 rounded-lg border border-[var(--glass-border)]/70 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_auto] gap-2 px-3 py-2 bg-[var(--glass)]/70 text-[11px] font-medium text-muted-foreground">
          <span>Prompt</span>
          <span>Model</span>
          <span className="text-right pr-1">Rank</span>
        </div>
        <div className="max-h-60 overflow-y-auto glass-scrollbar divide-y divide-[var(--glass-border)]/50">
          {citations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_auto] gap-2 px-3 py-1.5 text-xs w-full text-left hover:bg-[var(--glass-hover)]/60 transition-colors cursor-pointer"
            >
              <div className="min-w-0 text-left">
                <p className="font-medium text-foreground truncate" title={item.prompt}>
                  {item.prompt}
                </p>
                {item.companyName ? (
                  <span className="mt-0.5 inline-block rounded-full border border-[var(--sibling-primary)]/30 bg-[color-mix(in_srgb,var(--sibling-primary)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sibling-primary)]">
                    {item.companyName}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{item.model}</p>
              <p className="text-right text-[11px] tabular-nums">
                {item.rank != null ? `#${item.rank}` : '—'}
              </p>
            </button>
          ))}
        </div>
      </div>
      {modal}
    </>
  );
}
