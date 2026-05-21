'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type ChatInlineSelectOption = {
  value: string;
  label: string;
  description?: string;
  /** Small leading element (e.g. avatar circle) */
  leading?: ReactNode;
};

export function ChatInlineSelect({
  value,
  options,
  onChange,
  disabled,
  compact,
  ariaLabel,
  triggerLeading,
}: {
  value: string;
  options: ChatInlineSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Tighter trigger for composer footer */
  compact?: boolean;
  ariaLabel: string;
  /** Shown on closed trigger (e.g. current artist avatar) */
  triggerLeading?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex max-w-[11rem] items-center gap-1.5 rounded-lg border border-transparent text-left transition',
          compact ? 'px-2 py-1.5 text-[12px]' : 'px-2.5 py-2 text-[13px]',
          'hover:border-border/50 hover:bg-muted/50',
          open ? 'border-border/50 bg-muted/50' : '',
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        {triggerLeading ?? selected?.leading}
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {selected?.label ?? 'Select'}
        </span>
        <ChevronDown
          className={['h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition', open ? 'rotate-180' : ''].join(
            ' ',
          )}
          strokeWidth={2}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={[
            'absolute bottom-full left-0 z-50 mb-1 min-w-[12rem] overflow-hidden rounded-xl border border-border/60 bg-popover py-1 shadow-lg',
          ].join(' ')}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={[
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-muted/60',
                    active ? 'bg-primary/5' : '',
                  ].join(' ')}
                  onClick={() => {
                    onChange(opt.value);
                    close();
                  }}
                >
                  {opt.leading}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{opt.label}</span>
                    {opt.description ? (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{opt.description}</span>
                    ) : null}
                  </span>
                  {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
