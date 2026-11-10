import type { Occurrence, TimeSlot } from '../types';
import { addDays, addMinutes, isWeekend, MS_MIN, startOfDay } from './date';
import { isAllDayLike } from './layout';

/** Free intervals of a day inside working hours, ignoring all-day events */
export function freeSlots(
  occs: Occurrence[],
  day: Date,
  workStart: number,
  workEnd: number,
  minMinutes = 15,
  notBefore?: Date,
): TimeSlot[] {
  const ds = startOfDay(day);
  let from = addMinutes(ds, workStart * 60);
  const to = addMinutes(ds, workEnd * 60);
  if (notBefore && notBefore > from) {
    // round up to the next quarter hour
    const q = Math.ceil(notBefore.getTime() / (15 * MS_MIN)) * 15 * MS_MIN;
    from = new Date(q);
  }
  if (from >= to) return [];
  const busy = occs
    .filter((o) => !isAllDayLike(o) && o.start < to && o.end > from)
    .map((o) => [o.start.getTime(), o.end.getTime()] as const)
    .sort((a, b) => a[0] - b[0]);

  const out: TimeSlot[] = [];
  let cursor = from.getTime();
  for (const [s, e] of busy) {
    if (s > cursor) out.push({ start: new Date(cursor), end: new Date(Math.min(s, to.getTime())) });
    cursor = Math.max(cursor, e);
    if (cursor >= to.getTime()) break;
  }
  if (cursor < to.getTime()) out.push({ start: new Date(cursor), end: to });
  return out.filter((s) => (s.end.getTime() - s.start.getTime()) / MS_MIN >= minMinutes);
}

export function findNextSlot(
  getOccs: (from: Date, to: Date) => Occurrence[],
  from: Date,
  minutes: number,
  workStart: number,
  workEnd: number,
  skipWeekends = true,
  horizonDays = 21,
): TimeSlot | null {
  const occs = getOccs(startOfDay(from), addDays(startOfDay(from), horizonDays));
  for (let i = 0; i < horizonDays; i++) {
    const day = addDays(startOfDay(from), i);
    if (skipWeekends && isWeekend(day)) continue;
    const slots = freeSlots(occs, day, workStart, workEnd, minutes, from);
    if (slots.length) return { start: slots[0].start, end: addMinutes(slots[0].start, minutes) };
  }
  return null;
}

export const slotMinutes = (s: TimeSlot) => (s.end.getTime() - s.start.getTime()) / MS_MIN;
