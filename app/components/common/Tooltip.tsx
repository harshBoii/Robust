'use client';

import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
};

type TooltipCoords = {
  top: number;
  left: number;
};

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const rect = trigger.getBoundingClientRect();
    const { offsetWidth: tw, offsetHeight: th } = tooltip;
    const gap = 8;
    const padding = 8;

    let top = side === 'top' ? rect.top - th - gap : rect.bottom + gap;
    let left = rect.left + rect.width / 2 - tw / 2;

    left = Math.max(padding, Math.min(left, window.innerWidth - tw - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - th - padding));

    setCoords({ top, left });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    updatePosition();

    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, content, side, updatePosition]);

  const tooltipNode =
    open && typeof document !== 'undefined'
      ? createPortal(
          <span
            ref={tooltipRef}
            role="tooltip"
            style={
              coords
                ? { top: coords.top, left: coords.left, visibility: 'visible' }
                : { top: 0, left: 0, visibility: 'hidden' }
            }
            className="pointer-events-none fixed z-[110] w-max max-w-xs rounded-lg border border-[var(--glass-border)] bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
          >
            {content}
          </span>,
          document.body
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {tooltipNode}
    </>
  );
}
