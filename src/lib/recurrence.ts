import type { CalEvent, CalendarSource, Freq, Occurrence } from '../types';
import { addDays, addMonths, dateKey, diffDays, fromDateKey, isWeekend, MS_DAY } from './date';

export const FREQ_LABEL: Record<Freq, string> = {
  daily: 'Ogni giorno',
  weekdays: 'Giorni feriali (lun–ven)',
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  yearly: 'Ogni anno',
};

function step(d: Date, freq: Freq, n: number) {
  switch (freq) {
    case 'daily':
    case 'weekdays':
      return addDays(d, n);
    case 'weekly':
      return addDays(d, 7 * n);
    case 'monthly':
      return addMonths(d, n);
    case 'yearly':
      return addMonths(d, 12 * n);
  }
}

/** Expands an event into occurrences overlapping [rangeStart, rangeEnd) */
export function expandEvent(ev: CalEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const baseStart = new Date(ev.start);
  const baseEnd = new Date(ev.end);
  const duration = baseEnd.getTime() - baseStart.getTime();

  if (!ev.recurrence) {
    if (baseStart < rangeEnd && baseEnd > rangeStart) {
      return [{ key: ev.id, event: ev, start: baseStart, end: baseEnd, recurring: false }];
    }
    return [];
  }

  const { freq, until, exdates } = ev.recurrence;
  const untilDate = until ? addDays(fromDateKey(until), 1) : null;
  const ex = new Set(exdates ?? []);
  const out: Occurrence[] = [];

  // Jump close to the range for day/week based rules to avoid long iterations.
  let i = 0;
  if (freq === 'daily' || freq === 'weekdays' || freq === 'weekly') {
    const period = freq === 'weekly' ? 7 : 1;
    const days = diffDays(rangeStart, baseStart) - Math.ceil(duration / MS_DAY) - 1;
    if (days > 0) i = Math.floor(days / period);
  }

  for (let guard = 0; guard < 1500; guard++, i++) {
    const s = step(baseStart, freq, i);
    if (s >= rangeEnd) break;
    if (untilDate && s >= untilDate) break;
    if (freq === 'weekdays' && isWeekend(s)) continue;
    const e = new Date(s.getTime() + duration);
    if (e <= rangeStart) continue;
    const k = dateKey(s);
    if (ex.has(k)) continue;
    out.push({ key: `${ev.id}::${k}`, event: ev, start: s, end: e, recurring: true, occDate: k });
  }
  return out;
}

export function parseOccurrenceKey(key: string): { id: string; occDate?: string } {
  const [id, occDate] = key.split('::');
  return { id, occDate };
}

/** Rebuilds a single occurrence from its key (used by the side panel) */
export function occurrenceFromKey(key: string, events: CalEvent[]): Occurrence | null {
  const { id, occDate } = parseOccurrenceKey(key);
  const ev = events.find((e) => e.id === id);
  if (!ev) return null;
  if (!occDate || !ev.recurrence) {
    return { key: ev.id, event: ev, start: new Date(ev.start), end: new Date(ev.end), recurring: !!ev.recurrence };
  }
  const day = fromDateKey(occDate);
  const occs = expandEvent(ev, day, addDays(day, 1));
  return occs.find((o) => o.occDate === occDate) ?? null;
}

// ---------- Italian public holidays ----------

export const HOLIDAY_CAL_ID = 'holidays-it';

function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidaysForYear(year: number): [Date, string][] {
  const e = easter(year);
  return [
    [new Date(year, 0, 1), 'Capodanno'],
    [new Date(year, 0, 6), 'Epifania'],
    [e, 'Pasqua'],
    [addDays(e, 1), "Lunedì dell'Angelo"],
    [new Date(year, 3, 25), 'Festa della Liberazione'],
    [new Date(year, 4, 1), 'Festa dei Lavoratori'],
    [new Date(year, 5, 2), 'Festa della Repubblica'],
    [new Date(year, 7, 15), 'Ferragosto'],
    [new Date(year, 10, 1), 'Ognissanti'],
    [new Date(year, 11, 8), 'Immacolata Concezione'],
    [new Date(year, 11, 25), 'Natale'],
    [new Date(year, 11, 26), 'Santo Stefano'],
  ];
}

export function holidayOccurrences(rangeStart: Date, rangeEnd: Date, cal: CalendarSource): Occurrence[] {
  const out: Occurrence[] = [];
  for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
    for (const [d, name] of holidaysForYear(y)) {
      const end = addDays(d, 1);
      if (d < rangeEnd && end > rangeStart) {
        const id = `hol-${dateKey(d)}`;
        out.push({
          key: id,
          event: {
            id,
            title: name,
            start: d.toISOString(),
            end: end.toISOString(),
            allDay: true,
            calendarId: cal.id,
            createdAt: 0,
          },
          start: d,
          end,
          recurring: false,
          readOnly: true,
        });
      }
    }
  }
  return out;
}

export function holidayName(d: Date): string | null {
  for (const [h, name] of holidaysForYear(d.getFullYear())) {
    if (dateKey(h) === dateKey(d)) return name;
  }
  return null;
}

/** All visible occurrences in a range, sorted by start */
export function getOccurrences(
  events: CalEvent[],
  calendars: CalendarSource[],
  rangeStart: Date,
  rangeEnd: Date,
  includeHidden = false,
): Occurrence[] {
  const visible = new Set(calendars.filter((c) => includeHidden || c.visible).map((c) => c.id));
  const out: Occurrence[] = [];
  for (const ev of events) {
    if (!visible.has(ev.calendarId)) continue;
    out.push(...expandEvent(ev, rangeStart, rangeEnd));
  }
  const hol = calendars.find((c) => c.id === HOLIDAY_CAL_ID);
  if (hol && (hol.visible || includeHidden)) out.push(...holidayOccurrences(rangeStart, rangeEnd, hol));
  out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  return out;
}
