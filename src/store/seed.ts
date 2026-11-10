import type { CalEvent, CalendarSource, Settings, Task } from '../types';
import { addDays, addMinutes, startOfMonth, startOfWeek } from '../lib/date';
import { HOLIDAY_CAL_ID } from '../lib/recurrence';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accent: 'blue',
  weekStartsOn: 1,
  hideWeekends: false,
  showWeekNumbers: true,
  workStart: 9,
  workEnd: 18,
  hourHeight: 52,
  secondaryTz: null,
  defaultDuration: 60,
  showHolidays: true,
  dimPast: true,
  remindersEnabled: true,
};

export const seedCalendars = (): CalendarSource[] => [
  { id: 'work', name: 'Lavoro', color: 'blue', visible: true },
  { id: 'personal', name: 'Personale', color: 'green', visible: true },
  { id: 'focus', name: 'Focus', color: 'purple', visible: true },
  { id: 'sport', name: 'Sport & Salute', color: 'orange', visible: true },
  { id: HOLIDAY_CAL_ID, name: 'Festività italiane', color: 'red', visible: true, system: true },
];

let n = 0;
const id = () => `seed_${++n}`;

export function seedEvents(now = new Date()): CalEvent[] {
  n = 0;
  const mon = startOfWeek(now, 1);
  const at = (dayOffset: number, h: number, m = 0) => addMinutes(addDays(mon, dayOffset), h * 60 + m);
  const ev = (
    day: number,
    sh: number,
    sm: number,
    durMin: number,
    title: string,
    calendarId: string,
    extra: Partial<CalEvent> = {},
  ): CalEvent => {
    const start = at(day, sh, sm);
    return {
      id: id(),
      title,
      start: start.toISOString(),
      end: addMinutes(start, durMin).toISOString(),
      allDay: false,
      calendarId,
      createdAt: Date.now(),
      ...extra,
    };
  };
  const allDay = (day: number, days: number, title: string, calendarId: string, extra: Partial<CalEvent> = {}): CalEvent => {
    const s = addDays(mon, day);
    return {
      id: id(),
      title,
      start: s.toISOString(),
      end: addDays(s, days).toISOString(),
      allDay: true,
      calendarId,
      createdAt: Date.now(),
      ...extra,
    };
  };

  const firstOfMonth = startOfMonth(now);

  return [
    ev(0, 9, 30, 15, 'Daily standup', 'work', {
      recurrence: { freq: 'weekdays', exdates: [] },
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      attendees: ['Marco', 'Giulia', 'Sara'],
    }),
    ev(0, 10, 0, 90, 'Sprint planning', 'work', {
      location: 'Sala Orione',
      attendees: ['Team prodotto'],
      description: 'Definire le priorità dello sprint 42.\n- Rivedere il backlog\n- Stimare le storie',
    }),
    ev(0, 13, 0, 60, 'Pranzo con Giulia', 'personal', { location: 'Trattoria da Mario' }),
    ev(1, 9, 0, 120, 'Deep work: documento architettura', 'focus', { kind: 'focus' }),
    ev(1, 14, 0, 45, '1:1 con Marco', 'work', { meetingUrl: 'https://zoom.us/j/123456789' }),
    ev(1, 18, 30, 60, 'Palestra', 'sport', { recurrence: { freq: 'weekly', exdates: [] }, location: 'FitClub' }),
    ev(2, 11, 0, 60, 'Demo cliente Acme', 'work', {
      meetingUrl: 'https://zoom.us/j/987654321',
      attendees: ['Acme Corp', 'Sara'],
    }),
    ev(2, 11, 30, 60, 'Call fornitore', 'work', { meetingUrl: 'https://teams.microsoft.com/l/meetup-join/xyz' }),
    ev(2, 16, 0, 60, 'Revisione budget Q4', 'work', { location: 'Ufficio finanza' }),
    ev(3, 10, 0, 120, 'Workshop UX', 'work', { location: 'Sala Andromeda', attendees: ['Design team'] }),
    ev(3, 15, 0, 90, 'Focus: preparazione release', 'focus', { kind: 'focus' }),
    ev(3, 18, 30, 60, 'Palestra', 'sport', { recurrence: { freq: 'weekly', exdates: [] }, location: 'FitClub' }),
    ev(4, 15, 0, 60, 'Retrospettiva sprint', 'work', { meetingUrl: 'https://meet.google.com/xyz-retro' }),
    ev(4, 20, 30, 150, 'Cinema con amici', 'personal', { location: 'Cinema Odeon' }),
    allDay(5, 1, 'Gita al lago', 'personal', { location: 'Lago di Como' }),
    ev(6, 10, 0, 60, 'Corsa al parco', 'sport'),
    allDay(9, 3, 'Conferenza Design Week', 'work', { location: 'Milano' }),
    {
      id: id(),
      title: 'Pagare affitto',
      start: firstOfMonth.toISOString(),
      end: addDays(firstOfMonth, 1).toISOString(),
      allDay: true,
      calendarId: 'personal',
      recurrence: { freq: 'monthly', exdates: [] },
      createdAt: Date.now(),
    },
    {
      id: id(),
      title: '🎂 Compleanno di Sara',
      start: addDays(mon, 8).toISOString(),
      end: addDays(mon, 9).toISOString(),
      allDay: true,
      calendarId: 'personal',
      recurrence: { freq: 'yearly', exdates: [] },
      createdAt: Date.now(),
    },
  ];
}

export const seedTasks = (): Task[] => [
  { id: 'task_1', title: 'Preparare slide Q4', duration: 90, calendarId: 'work', done: false, priority: 2, createdAt: Date.now() },
  { id: 'task_2', title: 'Rispondere alle email', duration: 30, calendarId: 'work', done: false, priority: 1, createdAt: Date.now() },
  { id: 'task_3', title: 'Prenotare il dentista', duration: 15, calendarId: 'personal', done: false, priority: 0, createdAt: Date.now() },
  { id: 'task_4', title: 'Leggere report analytics', duration: 45, calendarId: 'work', done: false, priority: 0, createdAt: Date.now() },
];

