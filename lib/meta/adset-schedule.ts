export const SCHEDULE_DURATION_OPTIONS = [
  { value: '3_days', label: '3 days' },
  { value: '1_week', label: '1 week' },
  { value: '1_month', label: '1 month' },
  { value: 'custom', label: 'Custom end date' },
] as const;

export type ScheduleDuration = (typeof SCHEDULE_DURATION_OPTIONS)[number]['value'];

export function parseScheduleDuration(v: unknown): ScheduleDuration | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s === '3_days' || s === '1_week' || s === '1_month' || s === 'custom') return s;
  return null;
}

export function scheduleDurationLabel(value: string | null | undefined): string {
  const opt = SCHEDULE_DURATION_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? 'Not set';
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export type AdsetSchedulePresetFields = {
  scheduleDuration?: string | null;
  scheduleCustomEnd?: Date | string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
};

/** Resolve Meta ad set start/end from preset duration (relative to creation time) or legacy absolute times. */
export function resolveAdsetScheduleTimes(
  preset: AdsetSchedulePresetFields,
  now: Date = new Date(),
): { startTime: Date | null; endTime: Date | null } {
  const duration = parseScheduleDuration(preset.scheduleDuration);

  if (duration) {
    const start = now;
    let end: Date | null = null;

    switch (duration) {
      case '3_days':
        end = addDays(start, 3);
        break;
      case '1_week':
        end = addDays(start, 7);
        break;
      case '1_month':
        end = addMonths(start, 1);
        break;
      case 'custom': {
        end = toDate(preset.scheduleCustomEnd);
        break;
      }
      default:
        break;
    }

    if (end && end.getTime() > start.getTime()) {
      return { startTime: start, endTime: end };
    }
    return { startTime: null, endTime: null };
  }

  const legacyStart = toDate(preset.startTime);
  const legacyEnd = toDate(preset.endTime);
  if (legacyStart) {
    return {
      startTime: legacyStart,
      endTime: legacyEnd && legacyEnd.getTime() > legacyStart.getTime() ? legacyEnd : null,
    };
  }
  if (legacyEnd && legacyEnd.getTime() > now.getTime()) {
    return { startTime: now, endTime: legacyEnd };
  }

  return { startTime: null, endTime: null };
}
