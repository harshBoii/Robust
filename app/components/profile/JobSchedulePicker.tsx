'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import { calendarDaysForMonth } from '@/lib/date-range';
import {
  formatScheduleTime,
  scheduleFromCalendarDay,
  type CompanyJobSchedule,
} from '@/lib/jobs/company-jobs/schedule';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type JobFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';

type JobSchedulePickerProps = {
  frequency: JobFrequency;
  schedule: CompanyJobSchedule;
  disabled?: boolean;
  onChange: (schedule: CompanyJobSchedule) => void;
};

function toTimeValue(schedule: CompanyJobSchedule): string {
  return `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
}

function isSameWeekday(day: Date, dayOfWeek: number): boolean {
  return day.getDay() === dayOfWeek;
}

function isSameMonthDay(day: Date, dayOfMonth: number): boolean {
  return day.getDate() === dayOfMonth;
}

export function JobSchedulePicker({
  frequency,
  schedule,
  disabled = false,
  onChange,
}: JobSchedulePickerProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const cells = useMemo(() => calendarDaysForMonth(year, month), [year, month]);

  useEffect(() => {
    setViewMonth(new Date());
  }, [frequency]);

  const showCalendar = frequency === 'WEEKLY' || frequency === 'BIWEEKLY' || frequency === 'MONTHLY';

  const calendarHint =
    frequency === 'MONTHLY'
      ? 'Pick the day of month this job should run.'
      : frequency === 'WEEKLY' || frequency === 'BIWEEKLY'
        ? 'Pick any date on your preferred weekday.'
        : null;

  const pickDay = (day: Date) => {
    if (disabled) return;
    onChange(scheduleFromCalendarDay(frequency, day, schedule));
  };

  const isSelectedDay = (day: Date) => {
    if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
      return isSameWeekday(day, schedule.dayOfWeek);
    }
    if (frequency === 'MONTHLY') {
      return isSameMonthDay(day, schedule.dayOfMonth);
    }
    return false;
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-3">
      <div>
        <label className="text-[12px] font-medium text-muted-foreground">Run time</label>
        <input
          type="time"
          disabled={disabled}
          value={toTimeValue(schedule)}
          onChange={(e) => {
            const [hour, minute] = e.target.value.split(':').map(Number);
            if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
            onChange({ ...schedule, hour, minute });
          }}
          className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-[13px] disabled:opacity-60"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Timezone: {schedule.timezone === 'Asia/Kolkata' ? 'IST (Asia/Kolkata)' : schedule.timezone}
        </p>
      </div>

      {frequency === 'DAILY' ? (
        <p className="text-[11px] text-muted-foreground">
          Runs every day at {formatScheduleTime(schedule)}.
        </p>
      ) : null}

      {showCalendar ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[12px] font-medium text-muted-foreground">Calendar</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 disabled:opacity-60"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[7rem] text-center text-[11px] font-medium text-foreground">
                {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 disabled:opacity-60"
                aria-label="Next month"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {calendarHint ? (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              {calendarHint}
            </p>
          ) : null}

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const selected = isSelectedDay(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  className={[
                    'h-7 rounded-md text-[11px] font-medium transition disabled:opacity-60',
                    selected
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-foreground hover:bg-primary/10',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
