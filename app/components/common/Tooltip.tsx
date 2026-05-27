'use client';

import React, { useState } from 'react';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
};

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 w-max max-w-xs rounded-lg border border-[var(--glass-border)] bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm ${
            side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'top-full left-1/2 mt-2 -translate-x-1/2'
          }`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
