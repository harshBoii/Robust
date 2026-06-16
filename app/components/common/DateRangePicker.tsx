'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  calendarDaysForMonth,
  formatDateRangeLabel,
  isDateInRange,
  isSameDay,
  type DateRangeValue,
} from '@/lib/date-range';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  maxDate?: Date;
};

export function DateRangePicker({ value, onChange, maxDate }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date(value.end.getFullYear(), value.end.getMonth(), 1));
  const [draftStart, setDraftStart] = useState<Date | null>(value.start);
  const [draftEnd, setDraftEnd] = useState<Date | null>(value.end);
  const rootRef = useRef<HTMLDivElement>(null);

  const today = maxDate ?? new Date();
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const cells = calendarDaysForMonth(year, month);

  useEffect(() => {
    if (!open) return;
    setDraftStart(value.start);
    setDraftEnd(value.end);
    setViewMonth(new Date(value.end.getFullYear(), value.end.getMonth(), 1));
  }, [open, value.end, value.start]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickDay = (day: Date) => {
    if (day > today) return;

    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(day);
      setDraftEnd(null);
      return;
    }

    if (day < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(day);
    } else {
      setDraftEnd(day);
    }
  };

  const apply = () => {
    if (!draftStart) return;
    const end = draftEnd ?? draftStart;
    onChange({ start: draftStart, end });
    setOpen(false);
  };

  const clear = () => {
    const end = today;
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    setDraftStart(start);
    setDraftEnd(end);
    onChange({ start, end });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="glass-button inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border-subtle)] px-3 py-2 text-sm font-medium"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{formatDateRangeLabel(value)}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,320px)] rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-solid)] p-4 shadow-[var(--glass-shadow-lg)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-foreground">
              {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const disabled = day > today;
              const inRange =
                draftStart && draftEnd ? isDateInRange(day, draftStart, draftEnd) : false;
              const isStart = draftStart ? isSameDay(day, draftStart) : false;
              const isEnd = draftEnd ? isSameDay(day, draftEnd) : false;
              const isSingle = draftStart && !draftEnd ? isSameDay(day, draftStart) : false;

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={[
                    'h-8 rounded-lg text-xs font-medium transition',
                    disabled ? 'cursor-not-allowed text-muted-foreground/40' : 'hover:bg-primary/10',
                    inRange && !isStart && !isEnd ? 'bg-primary/15 text-foreground' : '',
                    isStart || isEnd || isSingle
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-foreground',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--glass-border-subtle)] pt-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</span>
              <input
                type="date"
                value={draftStart ? toInputDate(draftStart) : ''}
                max={toInputDate(today)}
                onChange={(e) => {
                  const d = parseInputDate(e.target.value);
                  if (d) setDraftStart(d);
                }}
                className="glass-input h-9 px-2 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</span>
              <input
                type="date"
                value={draftEnd ? toInputDate(draftEnd) : draftStart ? toInputDate(draftStart) : ''}
                min={draftStart ? toInputDate(draftStart) : undefined}
                max={toInputDate(today)}
                onChange={(e) => {
                  const d = parseInputDate(e.target.value);
                  if (d) setDraftEnd(d);
                }}
                className="glass-input h-9 px-2 text-xs"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={clear}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              Last 7 days
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!draftStart}
              className="glass-button-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
