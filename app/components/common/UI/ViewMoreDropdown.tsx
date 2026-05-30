'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from '@/app/components/common/Tooltip';

const IconMore = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export type ViewMoreDropdownProps = {
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  tooltipContent?: string;
  className?: string;
  align?: 'right' | 'left';
};

export function ViewMoreDropdown({
  children,
  tooltipContent = 'More options',
  className = '',
  align = 'right',
}: ViewMoreDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const el = containerRef.current;
    if (!el || typeof document === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 160;
    setPosition({
      top: rect.bottom + 4,
      left: align === 'right' ? rect.right - menuWidth : rect.left,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, align]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const container = containerRef.current;
      const menu = ref.current;
      if (
        container &&
        !container.contains(e.target as Node) &&
        menu &&
        !menu.contains(e.target as Node)
      ) {
        setOpen(false);
        setPosition(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const trigger = (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--glass)]/70 text-muted-foreground hover:text-foreground hover:bg-[var(--glass-hover)]"
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      <IconMore />
    </button>
  );

  const close = () => {
    setOpen(false);
    setPosition(null);
  };
  const menuContent = typeof children === 'function' ? children(close) : children;

  const menuEl =
    open && typeof document !== 'undefined' && position ? (
      <div
        ref={ref}
        className="fixed min-w-[160px] py-1 z-dropdown rounded-md border border-[var(--glass-border)] bg-background/95 shadow-lg backdrop-blur-sm"
        style={{ top: position.top, left: position.left }}
        role="menu"
      >
        {menuContent}
      </div>
    ) : null;

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`.trim()}>
        {tooltipContent ? <Tooltip content={tooltipContent}>{trigger}</Tooltip> : trigger}
      </div>
      {menuEl && createPortal(menuEl, document.body)}
    </>
  );
}
