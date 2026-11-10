import type { Settings, ViewType } from '../types';
import {
  addDays,
  addMonths,
  fmtDayMonth,
  fmtMonthLong,
  fmtMonthShort,
  isoWeek,
  isWeekend,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from './date';

export const VIEW_LABEL: Record<ViewType, string> = {
  day: 'Giorno',
  '3day': '3 giorni',
  week: 'Settimana',
  month: 'Mese',
  agenda: 'Agenda',
  year: 'Anno',
};

export const VIEW_KEY: Record<ViewType, string> = {
  day: 'D',
  '3day': '3',
  week: 'W',
  month: 'M',
  agenda: 'A',
  year: 'Y',
};

type S = Pick<Settings, 'weekStartsOn' | 'hideWeekends'>;

/** Days displayed by the time-grid views */
export function gridDays(view: ViewType, cursor: Date, s: S): Date[] {
  const c = startOfDay(cursor);
  if (view === 'day') return [c];
  if (view === '3day') return [c, addDays(c, 1), addDays(c, 2)];
  const start = startOfWeek(c, s.weekStartsOn);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return s.hideWeekends ? days.filter((d) => !isWeekend(d)) : days;
}

export function monthGrid(cursor: Date, s: S): Date[] {
  const first = startOfMonth(cursor);
  const start = startOfWeek(first, s.weekStartsOn);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return s.hideWeekends ? days.filter((d) => !isWeekend(d)) : days;
}

export const AGENDA_DAYS = 30;

export function viewRange(view: ViewType, cursor: Date, s: S): { start: Date; end: Date } {
  const c = startOfDay(cursor);
  switch (view) {
    case 'day':
      return { start: c, end: addDays(c, 1) };
    case '3day':
      return { start: c, end: addDays(c, 3) };
    case 'week': {
      const st = startOfWeek(c, s.weekStartsOn);
      return { start: st, end: addDays(st, 7) };
    }
    case 'month': {
      const st = startOfWeek(startOfMonth(c), s.weekStartsOn);
      return { start: st, end: addDays(st, 42) };
    }
    case 'agenda':
      return { start: c, end: addDays(c, AGENDA_DAYS) };
    case 'year': {
      const st = new Date(c.getFullYear(), 0, 1);
      return { start: st, end: new Date(c.getFullYear() + 1, 0, 1) };
    }
  }
}

export function stepCursor(view: ViewType, cursor: Date, dir: number): Date {
  switch (view) {
    case 'day':
      return addDays(cursor, dir);
    case '3day':
      return addDays(cursor, 3 * dir);
    case 'week':
      return addDays(cursor, 7 * dir);
    case 'month':
      return addMonths(cursor, dir);
    case 'agenda':
      return addDays(cursor, 14 * dir);
    case 'year':
      return addMonths(cursor, 12 * dir);
  }
}

export function viewTitle(view: ViewType, cursor: Date, s: S): { main: string; sub?: string } {
  if (view === 'year') return { main: String(cursor.getFullYear()) };
  if (view === 'month') return { main: fmtMonthLong(cursor), sub: String(cursor.getFullYear()) };
  if (view === 'day') return { main: fmtMonthLong(cursor), sub: `${cursor.getFullYear()} · Sett. ${isoWeek(cursor)}` };
  const days = view === 'agenda' ? [cursor, addDays(cursor, AGENDA_DAYS - 1)] : gridDays(view, cursor, s);
  const a = days[0];
  const b = days[days.length - 1];
  if (a.getMonth() === b.getMonth()) {
    return { main: fmtMonthLong(a), sub: `${a.getFullYear()} · Sett. ${isoWeek(a)}` };
  }
  if (view === 'agenda') return { main: `${fmtDayMonth(a)} – ${fmtDayMonth(b)}`, sub: String(b.getFullYear()) };
  return {
    main: `${fmtMonthShort(a)} – ${fmtMonthShort(b)}`,
    sub: `${b.getFullYear()} · Sett. ${isoWeek(a)}`,
  };
}
