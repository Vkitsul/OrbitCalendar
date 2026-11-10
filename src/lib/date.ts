export const MS_MIN = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) => addDays(startOfDay(d), 1);

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number) {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const max = daysInMonth(r.getFullYear(), r.getMonth());
  r.setDate(Math.min(day, max));
  return r;
}

export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * MS_MIN);

export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1) {
  const s = startOfDay(d);
  const diff = (s.getDay() - weekStartsOn + 7) % 7;
  return addDays(s, -diff);
}

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

export const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function setMinutesOfDay(d: Date, minutes: number) {
  const r = startOfDay(d);
  r.setMinutes(minutes);
  return r;
}

export function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDateKey(k: string) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Number of calendar days between two dates (ignores time & DST) */
export function diffDays(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ua - ub) / MS_DAY);
}

export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / MS_DAY + 1) / 7);
}

export function roundToStep(minutes: number, step = 15) {
  return Math.round(minutes / step) * step;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

// ---------- Formatting (Italian) ----------

const LOCALE = 'it-IT';
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, opts);
    cache.set(k, f);
  }
  return f;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtTime = (d: Date) => fmt({ hour: '2-digit', minute: '2-digit' }).format(d);
export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
export const fmtWeekdayShort = (d: Date) => cap(fmt({ weekday: 'short' }).format(d).replace('.', ''));
export const fmtWeekdayLong = (d: Date) => cap(fmt({ weekday: 'long' }).format(d));
export const fmtMonthLong = (d: Date) => cap(fmt({ month: 'long' }).format(d));
export const fmtMonthShort = (d: Date) => cap(fmt({ month: 'short' }).format(d).replace('.', ''));
export const fmtMonthYear = (d: Date) => cap(fmt({ month: 'long', year: 'numeric' }).format(d));
export const fmtDayMonth = (d: Date) => fmt({ day: 'numeric', month: 'short' }).format(d).replace('.', '');
export const fmtFullDate = (d: Date) =>
  cap(fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d));
export const fmtMediumDate = (d: Date) =>
  cap(fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(/\./g, ''));

export function fmtTimeRange(start: Date, end: Date) {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export function fmtDuration(minutes: number) {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtRelative(ms: number) {
  const min = Math.round(ms / MS_MIN);
  if (min < 1) return 'ora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 giorno' : `${d} giorni`;
}

export function fmtTimeInZone(d: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(d);
  } catch {
    return '';
  }
}

export function tzShortLabel(timeZone: string) {
  const city = timeZone.split('/').pop() ?? timeZone;
  return city.replace(/_/g, ' ');
}

export function tzOffsetLabel(timeZone: string, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(at);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Parses user-typed times like "9", "930", "9:30", "21.15" into minutes of day */
export function parseTimeInput(s: string): number | null {
  const t = s.trim().replace('.', ':');
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return clampTime(+m[1], +m[2]);
  m = t.match(/^(\d{1,2})$/);
  if (m) return clampTime(+m[1], 0);
  m = t.match(/^(\d{1,2})(\d{2})$/);
  if (m) return clampTime(+m[1], +m[2]);
  return null;
}

function clampTime(h: number, m: number) {
  if (h > 24 || m > 59) return null;
  return Math.min(h * 60 + m, 24 * 60);
}

export const minutesToLabel = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
