import type { JobFrequency } from './types';

export type CompanyJobSchedule = {
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  timezone: string;
};

export const DEFAULT_JOB_SCHEDULE: CompanyJobSchedule = {
  hour: 14,
  minute: 30,
  dayOfWeek: 1,
  dayOfMonth: 1,
  timezone: 'Asia/Kolkata',
};

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
};

function clampHour(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_JOB_SCHEDULE.hour;
  return Math.min(23, Math.max(0, Math.round(n)));
}

function clampMinute(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_JOB_SCHEDULE.minute;
  return Math.min(59, Math.max(0, Math.round(n)));
}

function clampDayOfWeek(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_JOB_SCHEDULE.dayOfWeek;
  return Math.min(6, Math.max(0, Math.round(n)));
}

function clampDayOfMonth(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_JOB_SCHEDULE.dayOfMonth;
  return Math.min(31, Math.max(1, Math.round(n)));
}

export function parseSchedule(raw: unknown): CompanyJobSchedule {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const timezone =
    typeof obj.timezone === 'string' && obj.timezone.trim()
      ? obj.timezone.trim()
      : DEFAULT_JOB_SCHEDULE.timezone;

  return {
    hour: clampHour(obj.hour),
    minute: clampMinute(obj.minute),
    dayOfWeek: clampDayOfWeek(obj.dayOfWeek),
    dayOfMonth: clampDayOfMonth(obj.dayOfMonth),
    timezone,
  };
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = get('weekday');
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dayOfWeek: dayOfWeek >= 0 ? dayOfWeek : 0,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function addDays(year: number, month: number, day: number, delta: number) {
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    dayOfWeek: date.getDay(),
  };
}

export function findUtcForLocalDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const start = Date.UTC(year, month - 1, day - 1, 0, 0, 0);
  const end = Date.UTC(year, month - 1, day + 2, 0, 0, 0);

  for (let t = start; t < end; t += 60_000) {
    const candidate = new Date(t);
    const zoned = getZonedParts(candidate, timeZone);
    if (
      zoned.year === year &&
      zoned.month === month &&
      zoned.day === day &&
      zoned.hour === hour &&
      zoned.minute === minute
    ) {
      return candidate;
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function referenceDateForFrequency(
  frequency: JobFrequency,
  schedule: CompanyJobSchedule,
  from: Date,
): { year: number; month: number; day: number } {
  const zoned = getZonedParts(from, schedule.timezone);

  if (frequency === 'DAILY') {
    return { year: zoned.year, month: zoned.month, day: zoned.day };
  }

  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    for (let offset = 0; offset < 7; offset += 1) {
      const next = addDays(zoned.year, zoned.month, zoned.day, offset);
      if (next.dayOfWeek === schedule.dayOfWeek) {
        return { year: next.year, month: next.month, day: next.day };
      }
    }
    return { year: zoned.year, month: zoned.month, day: zoned.day };
  }

  if (frequency === 'MONTHLY') {
    const dom = Math.min(schedule.dayOfMonth, daysInMonth(zoned.year, zoned.month));
    return { year: zoned.year, month: zoned.month, day: dom };
  }

  return { year: zoned.year, month: zoned.month, day: zoned.day };
}

export function cronFromSchedule(
  frequency: JobFrequency,
  schedule: CompanyJobSchedule,
): string | null {
  if (frequency === 'CUSTOM') return null;

  const ref = referenceDateForFrequency(frequency, schedule, new Date());
  const utc = findUtcForLocalDateTime(
    ref.year,
    ref.month,
    ref.day,
    schedule.hour,
    schedule.minute,
    schedule.timezone,
  );

  const minute = utc.getUTCMinutes();
  const hour = utc.getUTCHours();

  switch (frequency) {
    case 'DAILY':
      return `${minute} ${hour} * * *`;
    case 'WEEKLY':
    case 'BIWEEKLY':
      return `${minute} ${hour} * * ${utc.getUTCDay()}`;
    case 'MONTHLY':
      return `${minute} ${hour} ${utc.getUTCDate()} * *`;
    default:
      return null;
  }
}

export function formatScheduleTime(schedule: CompanyJobSchedule): string {
  const date = findUtcForLocalDateTime(
    2026,
    1,
    1,
    schedule.hour,
    schedule.minute,
    schedule.timezone,
  );
  return new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatScheduleLabel(
  frequency: JobFrequency,
  schedule: CompanyJobSchedule,
  enabled: boolean,
): string | null {
  if (!enabled) return null;

  const time = formatScheduleTime(schedule);
  const tzLabel = schedule.timezone === 'Asia/Kolkata' ? 'IST' : schedule.timezone;

  switch (frequency) {
    case 'DAILY':
      return `Scheduled daily at ${time} ${tzLabel}`;
    case 'WEEKLY':
      return `Scheduled every ${WEEKDAY_NAMES[schedule.dayOfWeek]} at ${time} ${tzLabel}`;
    case 'BIWEEKLY':
      return `Scheduled every other ${WEEKDAY_NAMES[schedule.dayOfWeek]} at ${time} ${tzLabel}`;
    case 'MONTHLY': {
      const suffix =
        schedule.dayOfMonth % 10 === 1 && schedule.dayOfMonth % 100 !== 11
          ? 'st'
          : schedule.dayOfMonth % 10 === 2 && schedule.dayOfMonth % 100 !== 12
            ? 'nd'
            : schedule.dayOfMonth % 10 === 3 && schedule.dayOfMonth % 100 !== 13
              ? 'rd'
              : 'th';
      return `Scheduled on the ${schedule.dayOfMonth}${suffix} of each month at ${time} ${tzLabel}`;
    }
    default:
      return null;
  }
}

export function computeNextRunAt(
  frequency: JobFrequency,
  schedule: CompanyJobSchedule,
  from = new Date(),
  lastRunAt: Date | null = null,
): Date | null {
  if (!enabledFrequency(frequency)) return null;

  const zoned = getZonedParts(from, schedule.timezone);
  const candidates: Date[] = [];

  const pushCandidate = (year: number, month: number, day: number) => {
    const utc = findUtcForLocalDateTime(
      year,
      month,
      day,
      schedule.hour,
      schedule.minute,
      schedule.timezone,
    );
    if (utc > from) candidates.push(utc);
  };

  if (frequency === 'DAILY') {
    pushCandidate(zoned.year, zoned.month, zoned.day);
    const tomorrow = addDays(zoned.year, zoned.month, zoned.day, 1);
    pushCandidate(tomorrow.year, tomorrow.month, tomorrow.day);
  }

  if (frequency === 'WEEKLY') {
    for (let offset = 0; offset < 14; offset += 1) {
      const next = addDays(zoned.year, zoned.month, zoned.day, offset);
      if (next.dayOfWeek === schedule.dayOfWeek) {
        pushCandidate(next.year, next.month, next.day);
        break;
      }
    }
  }

  if (frequency === 'BIWEEKLY') {
    for (let offset = 0; offset < 28; offset += 1) {
      const next = addDays(zoned.year, zoned.month, zoned.day, offset);
      if (next.dayOfWeek !== schedule.dayOfWeek) continue;
      const candidate = findUtcForLocalDateTime(
        next.year,
        next.month,
        next.day,
        schedule.hour,
        schedule.minute,
        schedule.timezone,
      );
      if (candidate <= from) continue;
      if (lastRunAt) {
        const daysSince = (candidate.getTime() - lastRunAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 14) continue;
      }
      candidates.push(candidate);
      break;
    }
  }

  if (frequency === 'MONTHLY') {
    for (let monthOffset = 0; monthOffset < 14; monthOffset += 1) {
      const monthDate = new Date(zoned.year, zoned.month - 1 + monthOffset, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const day = Math.min(schedule.dayOfMonth, daysInMonth(year, month));
      pushCandidate(year, month, day);
      if (candidates.length > 0) break;
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0] ?? null;
}

function enabledFrequency(frequency: JobFrequency): boolean {
  return frequency === 'DAILY' || frequency === 'WEEKLY' || frequency === 'BIWEEKLY' || frequency === 'MONTHLY';
}

export function scheduleFromCalendarDay(
  frequency: JobFrequency,
  day: Date,
  current: CompanyJobSchedule,
): CompanyJobSchedule {
  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    return { ...current, dayOfWeek: day.getDay() };
  }
  if (frequency === 'MONTHLY') {
    return { ...current, dayOfMonth: day.getDate() };
  }
  return current;
}
