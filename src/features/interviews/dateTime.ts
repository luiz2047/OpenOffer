export const DEFAULT_STAGE_DURATION_MS = 60 * 60 * 1000;
export const DEFAULT_TIME_VALUE = '09:00';

export interface StageDateRange {
  startsAt: number | null;
  endsAt: number | null;
}

export type StageDateRangeField = keyof StageDateRange;
export type CalendarDayLabelKind = 'today' | 'tomorrow' | 'date';

export interface CalendarDayLabels {
  today: string;
  tomorrow: string;
}

export function normalizeEpoch(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export function startOfLocalDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function toLocalDateTimeInputValue(ms?: number | null): string {
  const normalized = normalizeEpoch(ms);
  if (!normalized) return '';
  const date = new Date(normalized);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalDateTimeInputValue(value: string): number | null {
  if (!value) return null;
  return normalizeEpoch(new Date(value).getTime());
}

export function dateTimePartsFromEpoch(ms?: number | null): { date: Date | null; time: string } {
  const normalized = normalizeEpoch(ms);
  if (!normalized) {
    return { date: null, time: DEFAULT_TIME_VALUE };
  }

  const value = new Date(normalized);
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return {
    date,
    time: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  };
}

export function isValidLocalTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function epochFromLocalDateAndTime(date: Date | null, time: string): number | null {
  if (!date || !isValidLocalTime(time)) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return normalizeEpoch(next.getTime());
}

export function formatDateTimeLabel(ms?: number | null, locale?: string): string {
  const normalized = normalizeEpoch(ms);
  if (!normalized) return '';
  return new Date(normalized).toLocaleString(locale || undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function classifyCalendarDay(value: Date, reference = new Date()): CalendarDayLabelKind {
  const day = startOfLocalDay(value).getTime();
  const today = startOfLocalDay(reference).getTime();
  const tomorrow = addLocalDays(startOfLocalDay(reference), 1).getTime();

  if (day === today) return 'today';
  if (day === tomorrow) return 'tomorrow';
  return 'date';
}

export function formatCalendarDayLabel(
  value: Date,
  labels: CalendarDayLabels,
  locale?: string,
  reference = new Date(),
): string {
  const kind = classifyCalendarDay(value, reference);
  if (kind === 'today') return labels.today;
  if (kind === 'tomorrow') return labels.tomorrow;
  return value.toLocaleDateString(locale || undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function normalizeStageDateRange(range: StageDateRange, changedField: StageDateRangeField): StageDateRange {
  const startsAt = normalizeEpoch(range.startsAt);
  const endsAt = normalizeEpoch(range.endsAt);

  if (changedField === 'startsAt' && startsAt && (!endsAt || endsAt < startsAt)) {
    return {
      startsAt,
      endsAt: startsAt + DEFAULT_STAGE_DURATION_MS,
    };
  }

  return { startsAt, endsAt };
}

export function isStageDateRangeInvalid(range: StageDateRange): boolean {
  const startsAt = normalizeEpoch(range.startsAt);
  const endsAt = normalizeEpoch(range.endsAt);
  return Boolean(startsAt && endsAt && endsAt < startsAt);
}
