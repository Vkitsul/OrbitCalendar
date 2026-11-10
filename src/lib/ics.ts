import type { CalEvent, Freq } from '../types';
import { addDays, dateKey, fromDateKey } from './date';
import { uid } from './id';

const pad = (n: number) => String(n).padStart(2, '0');

function icsUtc(d: Date) {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

const icsDate = (d: Date) => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const unesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

function fold(line: string) {
  const out: string[] = [];
  let l = line;
  while (l.length > 74) {
    out.push(l.slice(0, 74));
    l = ' ' + l.slice(74);
  }
  out.push(l);
  return out.join('\r\n');
}

const RRULE: Record<Freq, string> = {
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

export function exportIcs(events: CalEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orbit Calendar//IT', 'CALSCALE:GREGORIAN'];
  const stamp = icsUtc(new Date());
  for (const ev of events) {
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@orbit`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(s)}`, `DTEND;VALUE=DATE:${icsDate(e)}`);
    } else {
      lines.push(`DTSTART:${icsUtc(s)}`, `DTEND:${icsUtc(e)}`);
    }
    lines.push(`SUMMARY:${esc(ev.title || 'Senza titolo')}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    const desc = [ev.description, ev.meetingUrl].filter(Boolean).join('\n');
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    if (ev.meetingUrl) lines.push(`URL:${ev.meetingUrl}`);
    if (ev.recurrence) {
      let rule = RRULE[ev.recurrence.freq];
      if (ev.recurrence.until) rule += `;UNTIL=${icsDate(fromDateKey(ev.recurrence.until))}T235959Z`;
      lines.push(`RRULE:${rule}`);
      for (const ex of ev.recurrence.exdates ?? []) {
        const exd = fromDateKey(ex);
        if (ev.allDay) lines.push(`EXDATE;VALUE=DATE:${icsDate(exd)}`);
        else {
          exd.setHours(s.getHours(), s.getMinutes());
          lines.push(`EXDATE:${icsUtc(exd)}`);
        }
      }
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

function parseIcsDate(value: string, params: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(v)) {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)))
    : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return { date, allDay: false };
}

export function importIcs(text: string, calendarId: string): CalEvent[] {
  const raw = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: CalEvent[] = [];
  let cur: Record<string, { value: string; params: string }[]> | null = null;

  for (const line of raw) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT' && cur) {
      const get = (k: string) => cur![k]?.[0];
      const ds = get('DTSTART');
      if (ds) {
        const start = parseIcsDate(ds.value, ds.params);
        const de = get('DTEND');
        const end = de ? parseIcsDate(de.value, de.params) : null;
        if (start) {
          const endDate = end?.date ?? (start.allDay ? addDays(start.date, 1) : new Date(start.date.getTime() + 3_600_000));
          const ev: CalEvent = {
            id: uid('ev_'),
            title: unesc(get('SUMMARY')?.value ?? 'Senza titolo'),
            start: start.date.toISOString(),
            end: endDate.toISOString(),
            allDay: start.allDay,
            calendarId,
            location: get('LOCATION') ? unesc(get('LOCATION')!.value) : undefined,
            description: get('DESCRIPTION') ? unesc(get('DESCRIPTION')!.value) : undefined,
            createdAt: Date.now(),
          };
          const text = `${ev.location ?? ''} ${ev.description ?? ''} ${get('URL')?.value ?? ''}`;
          const link = text.match(/https?:\/\/[^\s]*(zoom\.us|meet\.google|teams\.microsoft|webex)[^\s]*/i);
          if (link) ev.meetingUrl = link[0];
          const rr = get('RRULE')?.value;
          if (rr) {
            const f = rr.match(/FREQ=(\w+)/)?.[1];
            const byday = rr.match(/BYDAY=([\w,]+)/)?.[1];
            const until = rr.match(/UNTIL=(\d{8})/)?.[1];
            let freq: Freq | null = null;
            if (f === 'DAILY') freq = 'daily';
            else if (f === 'WEEKLY') freq = byday && byday.split(',').length === 5 ? 'weekdays' : 'weekly';
            else if (f === 'MONTHLY') freq = 'monthly';
            else if (f === 'YEARLY') freq = 'yearly';
            if (freq) {
              ev.recurrence = {
                freq,
                until: until ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : null,
                exdates: (cur!['EXDATE'] ?? [])
                  .flatMap((x) => x.value.split(','))
                  .map((v) => parseIcsDate(v, ''))
                  .filter((x): x is { date: Date; allDay: boolean } => !!x)
                  .map((x) => dateKey(x.date)),
              };
            }
          }
          out.push(ev);
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...params] = left.split(';');
    (cur[name.toUpperCase()] ??= []).push({ value, params: params.join(';') });
  }
  return out;
}

export function downloadFile(name: string, content: string, type = 'text/calendar') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
