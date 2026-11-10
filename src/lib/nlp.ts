import type { CalendarSource, Freq } from '../types';
import { addDays, addMonths, addMinutes, startOfDay, startOfWeek } from './date';

/**
 * Italian natural-language parser for quick event creation.
 * Examples:
 *   "Riunione con Luca domani alle 15 per 1h #lavoro"
 *   "Palestra ogni lunedì dalle 19 alle 20:30"
 *   "Cena @ Da Mario venerdì sera"
 *   "Ferie dal 12/08 tutto il giorno"
 */
export interface ParsedEvent {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  calendarId?: string;
  location?: string;
  recurrence?: Freq | null;
  hasDate: boolean;
  hasTime: boolean;
}

const ACCENTS: Record<string, string> = {
  à: 'a', á: 'a', è: 'e', é: 'e', ì: 'i', í: 'i', ò: 'o', ó: 'o', ù: 'u', ú: 'u', '’': "'", '‘': "'",
};

/** lower-case + strip accents while keeping the exact same length (so indexes map back) */
function normalize(s: string) {
  let out = '';
  for (const c of s) {
    const l = c.toLowerCase();
    out += l.length === 1 ? (ACCENTS[l] ?? l) : c;
  }
  return out;
}

const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const MONTHS = [
  ['gennaio', 'gen'], ['febbraio', 'feb'], ['marzo', 'mar'], ['aprile', 'apr'], ['maggio', 'mag'], ['giugno', 'giu'],
  ['luglio', 'lug'], ['agosto', 'ago'], ['settembre', 'set'], ['ottobre', 'ott'], ['novembre', 'nov'], ['dicembre', 'dic'],
];
const NUM_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8 };

const WD = WEEKDAYS.join('|');
const MO = MONTHS.flat().sort((a, b) => b.length - a.length).join('|');

type Period = 'morning' | 'afternoon' | 'evening' | null;

export function parseQuickAdd(
  input: string,
  opts: { now: Date; calendars: CalendarSource[]; defaultDuration: number },
): ParsedEvent {
  const { now, calendars, defaultDuration } = opts;
  const original = input;
  let work = normalize(input);
  const masked = new Array<boolean>(work.length).fill(false);

  const take = (re: RegExp): RegExpExecArray | null => {
    const m = re.exec(work);
    if (!m) return null;
    for (let i = m.index; i < m.index + m[0].length; i++) masked[i] = true;
    work = work.slice(0, m.index) + ' '.repeat(m[0].length) + work.slice(m.index + m[0].length);
    return m;
  };

  const today = startOfDay(now);
  let date: Date | null = null;
  let startMin: number | null = null;
  let endMin: number | null = null;
  let duration: number | null = null;
  let allDay = false;
  let recurrence: Freq | null = null;
  let period: Period = null;
  let calendarId: string | undefined;
  let location: string | undefined;

  // --- calendar tag
  const tag = take(/#([\p{L}\d_-]+)/u);
  if (tag) {
    const t = tag[1];
    const cal = calendars.find((c) => !c.system && normalize(c.name).startsWith(t));
    if (cal) calendarId = cal.id;
  }

  // --- all day
  if (take(/\b(tutto il giorno|tutta la giornata|giornata intera|intera giornata)\b/)) allDay = true;

  // --- recurrence
  const everyWd = take(new RegExp(`\\bogni\\s+(${WD})\\b`));
  if (everyWd) {
    recurrence = 'weekly';
    const target = WEEKDAYS.indexOf(everyWd[1]);
    date = addDays(today, (target - today.getDay() + 7) % 7);
  } else if (take(/\b(nei giorni feriali|ogni giorno feriale|giorni feriali|dal lunedi al venerdi|lun-ven)\b/)) {
    recurrence = 'weekdays';
  } else if (take(/\b(ogni giorno|tutti i giorni|quotidianamente|giornaliero)\b/)) recurrence = 'daily';
  else if (take(/\b(ogni settimana|settimanale|settimanalmente)\b/)) recurrence = 'weekly';
  else if (take(/\b(ogni mese|mensile|mensilmente)\b/)) recurrence = 'monthly';
  else if (take(/\b(ogni anno|annuale|annualmente)\b/)) recurrence = 'yearly';

  // --- duration
  let m = take(/\bper\s+(\d+(?:[.,]\d+)?)\s*(ore|ora|h|minuti|minuto|min|m)\b/);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    duration = m[2].startsWith('m') ? n : n * 60;
  } else if ((m = take(/\bper\s+(un'?ora e mezza|un'?ora e mezzo|mezz'?ora|un'?ora|(un|una|due|tre|quattro|cinque|sei|sette|otto) ore)\b/))) {
    const w = m[1];
    if (w.startsWith('mezz')) duration = 30;
    else if (w.includes('mezz')) duration = 90;
    else if (w.startsWith('un')) duration = 60;
    else duration = (NUM_WORDS[m[2]] ?? 1) * 60;
  } else if ((m = take(/\b(\d+)h(\d{1,2})?\b/))) {
    duration = +m[1] * 60 + (m[2] ? +m[2] : 0);
  } else if ((m = take(/\b(\d+)\s*(min|minuti)\b/))) {
    duration = +m[1];
  }

  // --- part of day keywords (may also set the date)
  if (take(/\b(stamattina|stamani|stamane)\b/)) {
    date = today;
    period = 'morning';
  } else if (take(/\b(stasera|stanotte)\b/)) {
    date = today;
    period = 'evening';
  } else if (take(/\b(oggi pomeriggio)\b/)) {
    date = today;
    period = 'afternoon';
  }
  const pm = take(/\b(?:di |la |nel |del |in )?(mattina|mattino|pomeriggio|sera|notte)\b/);
  if (pm) period = pm[1].startsWith('matt') ? 'morning' : pm[1] === 'pomeriggio' ? 'afternoon' : 'evening';

  // --- times
  const hm = (h: string, mm?: string) => +h * 60 + (mm ? +mm : 0);
  if ((m = take(/\b(?:dalle|dall'|da)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(?:alle|all'|a|-|–)\s*(\d{1,2})(?:[:.](\d{2}))?\b/))) {
    startMin = hm(m[1], m[2]);
    endMin = hm(m[3], m[4]);
  } else if ((m = take(/\b(?:alle|all'|ore|verso le|per le)\s*(\d{1,2})(?:[:.](\d{2}))?(?:\s*(?:-|–|alle)\s*(\d{1,2})(?:[:.](\d{2}))?)?\b/))) {
    startMin = hm(m[1], m[2]);
    if (m[3]) endMin = hm(m[3], m[4]);
  } else if ((m = take(/\b(\d{1,2})[:.](\d{2})(?:\s*(?:-|–)\s*(\d{1,2})(?:[:.](\d{2}))?)?\b/))) {
    startMin = hm(m[1], m[2]);
    if (m[3]) endMin = hm(m[3], m[4]);
  } else if (
    (m = /\b(\d{1,2})\s*(?:-|–)\s*(\d{1,2})\b(?![/-]\d)/.exec(work)) &&
    +m[2] > +m[1] &&
    +m[2] <= 24 &&
    +m[2] - +m[1] <= 12
  ) {
    take(/\b(\d{1,2})\s*(?:-|–)\s*(\d{1,2})\b(?![/-]\d)/);
    startMin = +m[1] * 60;
    endMin = +m[2] * 60;
  } else if (take(/\b(?:a\s+)?mezzogiorno\b/)) {
    startMin = 12 * 60;
  } else if (take(/\ball'una\b/)) {
    startMin = 13 * 60;
  }

  if (startMin !== null) {
    const h = Math.floor(startMin / 60);
    const shouldAddTwelve = (period === 'afternoon' || period === 'evening') ? h < 12 : period === null && h >= 1 && h <= 7;
    if (shouldAddTwelve) startMin += 12 * 60;
    if (endMin !== null) {
      while (endMin <= startMin && endMin + 12 * 60 <= 24 * 60) endMin += 12 * 60;
    }
  } else if (period && !allDay) {
    startMin = period === 'morning' ? 9 * 60 : period === 'afternoon' ? 15 * 60 : 20 * 60;
  }

  // --- dates
  if (!date) {
    if (take(/\bdopodomani\b/)) date = addDays(today, 2);
    else if (take(/\bdomani\b/)) date = addDays(today, 1);
    else if (take(/\boggi\b/)) date = today;
    else if (take(/\bieri\b/)) date = addDays(today, -1);
    else if ((m = take(/\b(?:tra|fra)\s+(\d+|un|una|due|tre|quattro|cinque|sei|sette|otto)\s+(giorni|giorno|settimane|settimana|mesi|mese)\b/))) {
      const n = /\d/.test(m[1]) ? +m[1] : NUM_WORDS[m[1]] ?? 1;
      date = m[2].startsWith('giorn') ? addDays(today, n) : m[2].startsWith('settiman') ? addDays(today, 7 * n) : addMonths(today, n);
    } else if ((m = take(new RegExp(`\\b(?:(?:il|la)\\s+)?(?:(prossimo|prossima)\\s+)?(${WD})(?:\\s+(prossimo|prossima))?\\b`)))) {
      const target = WEEKDAYS.indexOf(m[2]);
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      date = addDays(today, diff);
      if (take(/\b(della )?(settimana prossima|prossima settimana)\b/)) {
        const nextWeek = addDays(startOfWeek(today, 1), 7);
        date = addDays(nextWeek, (target + 6) % 7);
      }
    } else if ((m = take(/\b(?:la\s+)?(settimana prossima|prossima settimana)\b/))) {
      date = addDays(startOfWeek(today, 1), 7);
    } else if ((m = take(new RegExp(`\\b(?:il\\s+|dal\\s+|del\\s+)?(\\d{1,2})\\s+(${MO})\\.?(?:\\s+(\\d{4}))?\\b`)))) {
      const mi = MONTHS.findIndex((pair) => pair.includes(m![2]));
      const y = m[3] ? +m[3] : today.getFullYear();
      date = new Date(y, mi, +m[1]);
      if (!m[3] && date < today) date = new Date(y + 1, mi, +m[1]);
    } else if ((m = take(/\b(?:il\s+|dal\s+|del\s+)?([12]\d|3[01]|0?[1-9])[/-](1[0-2]|0?[1-9])(?:[/-](\d{2,4}))?\b/))) {
      let y = m[3] ? +m[3] : today.getFullYear();
      if (y < 100) y += 2000;
      date = new Date(y, +m[2] - 1, +m[1]);
      if (!m[3] && date < today) date = new Date(y + 1, +m[2] - 1, +m[1]);
    } else if ((m = take(/\b(?:il|dal)\s+(\d{1,2})\b/))) {
      const d = +m[1];
      if (d >= 1 && d <= 31) {
        date = new Date(today.getFullYear(), today.getMonth(), d);
        if (date < today) date = addMonths(date, 1);
      }
    }
  }

  // --- location ("@ place")
  const loc = /@\s*([^@]+)$/.exec(work);
  if (loc) {
    const s = loc.index;
    let raw = '';
    for (let i = s + 1; i < s + loc[0].length; i++) if (!masked[i]) raw += original[i];
    raw = raw.replace(/\s+/g, ' ').trim();
    if (raw) location = raw;
    for (let i = s; i < s + loc[0].length; i++) masked[i] = true;
  }

  // --- title
  let title = '';
  for (let i = 0; i < original.length; i++) if (!masked[i]) title += original[i];
  title = title.replace(/\s+/g, ' ').trim();
  const connectors = /^(il|la|le|alle|a|di|da|per|e|del|della|,|-|–)\s+|\s+(il|la|le|alle|a|di|da|per|e|del|della|con|,|-|–)$/i;
  for (let k = 0; k < 4; k++) title = title.replace(connectors, '').trim();
  title = title.replace(/[,\s-]+$/, '');
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  // --- resolve
  const hasDate = !!date;
  const hasTime = startMin !== null;
  let start: Date;
  let end: Date;

  if (allDay || (hasDate && !hasTime && duration === null)) {
    allDay = true;
    start = date ?? today;
    end = addDays(start, 1);
  } else {
    let base = date ?? today;
    let sMin = startMin;
    if (sMin === null) {
      if (date) sMin = 9 * 60;
      else {
        const next = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30;
        sMin = next;
      }
    }
    start = addMinutes(base, sMin);
    if (!date && hasTime && start < now && !recurrence) {
      base = addDays(base, 1);
      start = addMinutes(base, sMin);
    }
    if (endMin !== null) end = addMinutes(base, endMin <= sMin ? endMin + 24 * 60 : endMin);
    else end = addMinutes(start, duration ?? defaultDuration);
  }

  return { title, start, end, allDay, calendarId, location, recurrence, hasDate, hasTime };
}
