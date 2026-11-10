import { useStore, type AvailabilitySlot } from '../store/useStore';
import type { CalEvent, Occurrence } from '../types';
import {
  addDays,
  addMinutes,
  fmtMediumDate,
  fmtTime,
  isSameDay,
  isWeekend,
  localTimeZone,
  MS_MIN,
  startOfDay,
  tzOffsetLabel,
} from './date';
import { downloadFile, exportIcs, importIcs } from './ics';
import { uid } from './id';
import { getOccurrences } from './recurrence';
import { freeSlots, slotMinutes } from './scheduling';
import { gridDays, viewRange } from './view';

const st = () => useStore.getState();

function occs(start: Date, end: Date, extra: CalEvent[] = []): Occurrence[] {
  const { events, calendars } = st();
  return getOccurrences([...events, ...extra], calendars, start, end);
}

/** Create a new draft event at the next half hour of the current day (or 9:00 on other days) */
export function newEventDraft() {
  const s = st();
  const now = new Date();
  if (s.view === 'year' || s.view === 'agenda') s.setView('week');
  const { start: rs, end: re } = viewRange(st().view, new Date(s.cursor), s.settings);
  let start: Date;
  if (now >= rs && now < re) {
    const next = Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 30) * 30;
    start = addMinutes(startOfDay(now), next);
  } else start = addMinutes(st().view === 'month' ? new Date(s.cursor) : rs, s.settings.workStart * 60);
  if (!isSameDay(start, new Date(st().cursor)) && st().view === 'day') st().setCursor(start);
  s.createEvent(
    { start: start.toISOString(), end: addMinutes(start, s.settings.defaultDuration).toISOString() },
    { draft: true },
  );
}

function focusCalendarId() {
  const cals = st().calendars.filter((c) => !c.system);
  return (cals.find((c) => /focus/i.test(c.name)) ?? cals[0])?.id ?? 'focus';
}

/** Adds up to 2h "focus" blocks in the biggest free slot of each working day of the visible week */
export function protectFocusTime() {
  const s = st();
  const days = gridDays('week', new Date(s.cursor), { weekStartsOn: s.settings.weekStartsOn, hideWeekends: true });
  const now = new Date();
  const created: CalEvent[] = [];
  for (const day of days) {
    if (isWeekend(day) || addDays(day, 1) <= now) continue;
    const dayOccs = occs(startOfDay(day), addDays(day, 1), created);
    const hasFocus = dayOccs.some((o) => o.event.kind === 'focus' && !o.event.allDay);
    if (hasFocus) continue;
    const slots = freeSlots(dayOccs, day, s.settings.workStart, s.settings.workEnd, 90, now);
    if (!slots.length) continue;
    const best = slots.reduce((a, b) => (slotMinutes(b) > slotMinutes(a) ? b : a));
    const len = Math.min(120, Math.floor(slotMinutes(best) / 15) * 15);
    created.push({
      id: uid('ev_'),
      title: 'Tempo focus',
      start: best.start.toISOString(),
      end: addMinutes(best.start, len).toISOString(),
      allDay: false,
      calendarId: focusCalendarId(),
      kind: 'focus',
      description: 'Blocco protetto automaticamente da Orbit per il lavoro concentrato.',
      createdAt: Date.now(),
    });
  }
  if (!created.length) {
    s.pushToast({ message: 'Nessuno slot da 90 min disponibile (o i blocchi focus esistono già)' });
    return;
  }
  s.pushHistory();
  useStore.setState((x) => ({ events: [...x.events, ...created] }));
  s.pushToast({
    message: `Protetti ${created.length} blocchi focus questa settimana`,
    tone: 'success',
    action: { label: 'Annulla', run: () => st().undo() },
  });
}

/** Places every unscheduled task in the first free working slot, by priority */
export function autoScheduleTasks() {
  const s = st();
  const pending = s.tasks
    .filter((t) => !t.done && !t.scheduledEventId)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.createdAt - b.createdAt);
  if (!pending.length) {
    s.pushToast({ message: 'Nessuna attività da pianificare 🎉' });
    return;
  }
  const now = new Date();
  const created: CalEvent[] = [];
  const links: Record<string, string> = {};
  for (const task of pending) {
    let placed = false;
    for (let i = 0; i < 21 && !placed; i++) {
      const day = addDays(startOfDay(now), i);
      if (isWeekend(day)) continue;
      const dayOccs = occs(day, addDays(day, 1), created);
      const slot = freeSlots(dayOccs, day, s.settings.workStart, s.settings.workEnd, task.duration, now)[0];
      if (!slot) continue;
      const ev: CalEvent = {
        id: uid('ev_'),
        title: task.title,
        start: slot.start.toISOString(),
        end: addMinutes(slot.start, task.duration).toISOString(),
        allDay: false,
        calendarId: task.calendarId,
        kind: 'task',
        taskId: task.id,
        createdAt: Date.now(),
      };
      created.push(ev);
      links[task.id] = ev.id;
      placed = true;
    }
  }
  s.pushHistory();
  useStore.setState((x) => ({
    events: [...x.events, ...created],
    tasks: x.tasks.map((t) => (links[t.id] ? { ...t, scheduledEventId: links[t.id] } : t)),
  }));
  const first = created[0];
  s.pushToast({
    message: `Pianificate ${created.length} attività nei tuoi slot liberi`,
    tone: 'success',
    action: { label: 'Annulla', run: () => st().undo() },
    secondary: first
      ? {
          label: 'Mostra',
          run: () => {
            st().setCursor(new Date(first.start));
            if (st().view === 'year' || st().view === 'agenda') st().setView('week');
          },
        }
      : undefined,
  });
}

export function exportCalendar() {
  const s = st();
  const visible = new Set(s.calendars.filter((c) => c.visible && !c.system).map((c) => c.id));
  const evs = s.events.filter((e) => visible.has(e.calendarId));
  downloadFile(`orbit-calendar-${new Date().toISOString().slice(0, 10)}.ics`, exportIcs(evs));
  s.pushToast({ message: `Esportati ${evs.length} eventi in formato .ics`, tone: 'success' });
}

export function importCalendarFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.ics,text/calendar';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const s = st();
    const name = file.name.replace(/\.ics$/i, '') || 'Importati';
    const calId = s.addCalendar(name.slice(0, 32), 'teal');
    const evs = importIcs(text, calId);
    s.importEvents(evs);
    s.pushToast({
      message: evs.length ? `Importati ${evs.length} eventi in “${name}”` : 'Nessun evento trovato nel file',
      tone: evs.length ? 'success' : 'default',
      action: { label: 'Annulla', run: () => (st().undo(), st().undo()) },
    });
  };
  input.click();
}

/** Fills the availability selection with the free working-hour slots of the visible days */
export function fillAvailabilityFromFreeTime() {
  const s = st();
  const days = gridDays(s.view, new Date(s.cursor), s.settings);
  const now = new Date();
  const all = occs(startOfDay(days[0]), addDays(days[days.length - 1], 1));
  const slots: AvailabilitySlot[] = [];
  for (const d of days) {
    if (addDays(d, 1) <= now || isWeekend(d)) continue;
    for (const f of freeSlots(all, d, s.settings.workStart, s.settings.workEnd, 30, now)) {
      slots.push({ start: f.start.getTime(), end: f.end.getTime() });
    }
  }
  s.setAvailabilitySlots(slots);
  if (!slots.length) s.pushToast({ message: 'Nessuno slot libero nei giorni visibili' });
}

export function availabilityText(slots: AvailabilitySlot[]) {
  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const sl of slots) {
    const k = startOfDay(new Date(sl.start)).toISOString();
    byDay.set(k, [...(byDay.get(k) ?? []), sl]);
  }
  const tz = localTimeZone();
  const lines = ['Ecco quando sono disponibile:', ''];
  for (const [k, list] of [...byDay.entries()].sort()) {
    const ranges = list.map((x) => `${fmtTime(new Date(x.start))}–${fmtTime(new Date(x.end))}`).join(', ');
    lines.push(`• ${fmtMediumDate(new Date(k))}: ${ranges}`);
  }
  lines.push('', `Orari in ${tz.replace(/_/g, ' ')} (${tzOffsetLabel(tz)})`);
  return lines.join('\n');
}

export async function copyAvailability() {
  const s = st();
  const slots = s.availability.slots;
  if (!slots.length) {
    s.pushToast({ message: 'Seleziona prima qualche slot sul calendario' });
    return;
  }
  const text = availabilityText(slots);
  try {
    await navigator.clipboard.writeText(text);
    const total = slots.reduce((a, x) => a + (x.end - x.start) / MS_MIN, 0);
    s.pushToast({ message: `Disponibilità copiata (${slots.length} slot, ${Math.round(total / 60)} h)`, tone: 'success' });
  } catch {
    s.pushToast({ message: 'Impossibile accedere agli appunti' });
  }
}
