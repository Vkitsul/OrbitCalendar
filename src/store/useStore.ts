import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalEvent, CalendarSource, ColorKey, Settings, Task, ViewType } from '../types';
import { addDays, addMinutes, startOfDay } from '../lib/date';
import { uid } from '../lib/id';
import { parseOccurrenceKey } from '../lib/recurrence';
import { stepCursor } from '../lib/view';
import { DEFAULT_SETTINGS, seedCalendars, seedEvents, seedTasks } from './seed';

export interface Toast {
  id: string;
  message: string;
  tone?: 'default' | 'success' | 'reminder';
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
  duration?: number;
}

interface Snapshot {
  events: CalEvent[];
  tasks: Task[];
  calendars: CalendarSource[];
}

export interface AvailabilitySlot {
  start: number;
  end: number;
}

export interface Store {
  events: CalEvent[];
  calendars: CalendarSource[];
  tasks: Task[];
  settings: Settings;

  view: ViewType;
  cursor: number;
  sidebarOpen: boolean;
  selectedKey: string | null;
  draftId: string | null;
  rightPanel: 'event' | 'insights' | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  availability: { active: boolean; slots: AvailabilitySlot[] };
  toasts: Toast[];
  past: Snapshot[];

  setView: (v: ViewType) => void;
  setCursor: (d: Date) => void;
  goToday: () => void;
  step: (dir: number) => void;

  select: (key: string | null) => void;
  closePanel: () => void;
  toggleInsights: () => void;

  createEvent: (e: Partial<CalEvent> & { start: string; end: string }, opts?: { draft?: boolean; select?: boolean }) => CalEvent;
  updateEvent: (id: string, patch: Partial<CalEvent>, record?: boolean) => void;
  moveOccurrence: (key: string, start: Date, end: Date) => string;
  detachOccurrence: (key: string) => string | null;
  deleteOccurrence: (key: string, scope?: 'one' | 'all') => void;
  duplicateOccurrence: (key: string) => void;
  importEvents: (events: CalEvent[]) => void;

  addCalendar: (name: string, color: ColorKey) => string;
  updateCalendar: (id: string, patch: Partial<CalendarSource>) => void;
  toggleCalendar: (id: string) => void;
  soloCalendar: (id: string) => void;
  removeCalendar: (id: string) => void;

  addTask: (t: Pick<Task, 'title' | 'duration' | 'calendarId'> & Partial<Task>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  scheduleTask: (id: string, start: Date) => string | null;
  toggleEventDone: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;

  setPalette: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setAvailability: (active: boolean) => void;
  addAvailabilitySlot: (s: AvailabilitySlot) => void;
  removeAvailabilitySlot: (i: number) => void;
  setAvailabilitySlots: (s: AvailabilitySlot[]) => void;

  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  pushHistory: () => void;
  undo: () => void;
  resetDemo: () => void;
}

const MAX_HISTORY = 60;

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const snapshot = (): Snapshot => {
        const { events, tasks, calendars } = get();
        return { events, tasks, calendars };
      };
      const record = () => set((s) => ({ past: [...s.past.slice(-MAX_HISTORY + 1), snapshot()] }));

      /** removes the draft event if it was left without a title */
      const discardEmptyDraft = (nextKey: string | null) => {
        const { draftId, events } = get();
        if (!draftId) return;
        if (nextKey && parseOccurrenceKey(nextKey).id === draftId) return;
        const ev = events.find((e) => e.id === draftId);
        if (ev && !ev.title.trim()) {
          set((s) => ({ events: s.events.filter((e) => e.id !== draftId), past: s.past.slice(0, -1) }));
        }
        set({ draftId: null });
      };

      const toast = (t: Omit<Toast, 'id'>) => get().pushToast(t);
      const undoAction = { label: 'Annulla', run: () => get().undo() };

      return {
        events: seedEvents(),
        calendars: seedCalendars(),
        tasks: seedTasks(),
        settings: DEFAULT_SETTINGS,

        view: 'week',
        cursor: startOfDay(new Date()).getTime(),
        sidebarOpen: true,
        selectedKey: null,
        draftId: null,
        rightPanel: null,
        paletteOpen: false,
        settingsOpen: false,
        shortcutsOpen: false,
        availability: { active: false, slots: [] },
        toasts: [],
        past: [],

        // ---------------- navigation
        setView: (view) => set({ view }),
        setCursor: (d) => set({ cursor: startOfDay(d).getTime() }),
        goToday: () => set({ cursor: startOfDay(new Date()).getTime() }),
        step: (dir) => set((s) => ({ cursor: stepCursor(s.view, new Date(s.cursor), dir).getTime() })),

        // ---------------- selection
        select: (key) => {
          discardEmptyDraft(key);
          set({ selectedKey: key, rightPanel: key ? 'event' : get().rightPanel === 'event' ? null : get().rightPanel });
        },
        closePanel: () => {
          discardEmptyDraft(null);
          set({ selectedKey: null, rightPanel: null });
        },
        toggleInsights: () => {
          discardEmptyDraft(null);
          set((s) => ({ rightPanel: s.rightPanel === 'insights' ? null : 'insights', selectedKey: null }));
        },

        // ---------------- events
        createEvent: (partial, opts = {}) => {
          record();
          const s = get();
          const ev: CalEvent = {
            id: uid('ev_'),
            title: '',
            allDay: false,
            calendarId: s.calendars.find((c) => !c.system)?.id ?? 'work',
            createdAt: Date.now(),
            kind: 'event',
            ...(Object.fromEntries(Object.entries(partial).filter(([, v]) => v !== undefined)) as typeof partial),
          };
          set((st) => ({ events: [...st.events, ev] }));
          if (opts.select !== false) {
            discardEmptyDraft(ev.id);
            set({ selectedKey: ev.id, rightPanel: 'event', draftId: opts.draft ? ev.id : null });
          }
          return ev;
        },

        updateEvent: (id, patch, rec = true) => {
          if (rec) record();
          set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        },

        detachOccurrence: (key) => {
          const { id, occDate } = parseOccurrenceKey(key);
          const base = get().events.find((e) => e.id === id);
          if (!base || !occDate || !base.recurrence) return null;
          const bs = new Date(base.start);
          const dur = new Date(base.end).getTime() - bs.getTime();
          const [y, m, d] = occDate.split('-').map(Number);
          const start = new Date(y, m - 1, d, bs.getHours(), bs.getMinutes());
          const copy: CalEvent = {
            ...base,
            id: uid('ev_'),
            start: start.toISOString(),
            end: new Date(start.getTime() + dur).toISOString(),
            recurrence: null,
            createdAt: Date.now(),
          };
          set((s) => ({
            events: [
              ...s.events.map((e) =>
                e.id === id
                  ? { ...e, recurrence: { ...e.recurrence!, exdates: [...(e.recurrence!.exdates ?? []), occDate] } }
                  : e,
              ),
              copy,
            ],
            selectedKey: s.selectedKey === key ? copy.id : s.selectedKey,
          }));
          return copy.id;
        },

        moveOccurrence: (key, start, end) => {
          record();
          const { occDate } = parseOccurrenceKey(key);
          let id = parseOccurrenceKey(key).id;
          if (occDate) {
            const newId = get().detachOccurrence(key);
            if (newId) id = newId;
            toast({ message: 'Spostato solo questo evento della serie', action: undoAction });
          }
          set((s) => ({
            events: s.events.map((e) =>
              e.id === id ? { ...e, start: start.toISOString(), end: end.toISOString() } : e,
            ),
          }));
          return id;
        },

        deleteOccurrence: (key, scope = 'one') => {
          const { id, occDate } = parseOccurrenceKey(key);
          const ev = get().events.find((e) => e.id === id);
          if (!ev) return;
          record();
          if (ev.recurrence && occDate && scope === 'one') {
            set((s) => ({
              events: s.events.map((e) =>
                e.id === id
                  ? { ...e, recurrence: { ...e.recurrence!, exdates: [...(e.recurrence!.exdates ?? []), occDate] } }
                  : e,
              ),
            }));
          } else {
            set((s) => ({
              events: s.events.filter((e) => e.id !== id),
              tasks: ev.taskId
                ? s.tasks.map((t) => (t.id === ev.taskId ? { ...t, scheduledEventId: null } : t))
                : s.tasks,
            }));
          }
          const s = get();
          if (s.selectedKey === key || (scope === 'all' && s.selectedKey?.startsWith(id))) {
            set({ selectedKey: null, rightPanel: s.rightPanel === 'event' ? null : s.rightPanel });
          }
          if (s.draftId === id) set({ draftId: null });
          else
            toast({
              message: ev.taskId ? 'Attività riportata nella inbox' : `“${ev.title || 'Senza titolo'}” eliminato`,
              action: undoAction,
            });
        },

        duplicateOccurrence: (key) => {
          const { id, occDate } = parseOccurrenceKey(key);
          const ev = get().events.find((e) => e.id === id);
          if (!ev) return;
          let start = new Date(ev.start);
          const dur = new Date(ev.end).getTime() - start.getTime();
          if (occDate) {
            const [y, m, d] = occDate.split('-').map(Number);
            start = new Date(y, m - 1, d, start.getHours(), start.getMinutes());
          }
          // place the copy right after the original (next day for all-day events)
          const newStart = ev.allDay ? addDays(start, 1) : new Date(start.getTime() + dur);
          const { id: _id, recurrence: _rec, taskId: _task, createdAt: _c, ...rest } = ev;
          get().createEvent({
            ...rest,
            start: newStart.toISOString(),
            end: new Date(newStart.getTime() + dur).toISOString(),
          });
          toast({ message: 'Evento duplicato', action: undoAction });
        },

        importEvents: (evs) => {
          record();
          set((s) => ({ events: [...s.events, ...evs] }));
        },

        // ---------------- calendars
        addCalendar: (name, color) => {
          record();
          const id = uid('cal_');
          set((s) => {
            const sys = s.calendars.filter((c) => c.system);
            const user = s.calendars.filter((c) => !c.system);
            return { calendars: [...user, { id, name, color, visible: true }, ...sys] };
          });
          return id;
        },
        updateCalendar: (id, patch) => {
          record();
          set((s) => ({ calendars: s.calendars.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
        },
        toggleCalendar: (id) =>
          set((s) => ({ calendars: s.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)) })),
        soloCalendar: (id) =>
          set((s) => {
            const alreadySolo = s.calendars.every((c) => c.visible === (c.id === id));
            return { calendars: s.calendars.map((c) => ({ ...c, visible: alreadySolo ? true : c.id === id })) };
          }),
        removeCalendar: (id) => {
          const cal = get().calendars.find((c) => c.id === id);
          if (!cal || cal.system) return;
          record();
          set((s) => ({
            calendars: s.calendars.filter((c) => c.id !== id),
            events: s.events.filter((e) => e.calendarId !== id),
            tasks: s.tasks.filter((t) => t.calendarId !== id),
          }));
          toast({ message: `Calendario “${cal.name}” eliminato`, action: undoAction });
        },

        // ---------------- tasks
        addTask: (t) => {
          record();
          set((s) => ({
            tasks: [{ id: uid('task_'), done: false, priority: 0, createdAt: Date.now(), ...t }, ...s.tasks],
          }));
        },
        updateTask: (id, patch) => {
          record();
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        },
        removeTask: (id) => {
          record();
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
        },
        scheduleTask: (id, start) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task) return null;
          record();
          const ev: CalEvent = {
            id: uid('ev_'),
            title: task.title,
            start: start.toISOString(),
            end: addMinutes(start, task.duration).toISOString(),
            allDay: false,
            calendarId: task.calendarId,
            kind: 'task',
            taskId: task.id,
            done: task.done,
            createdAt: Date.now(),
          };
          set((s) => ({
            events: [...s.events, ev],
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, scheduledEventId: ev.id } : t)),
          }));
          return ev.id;
        },
        toggleEventDone: (id) => {
          record();
          const ev = get().events.find((e) => e.id === id);
          if (!ev) return;
          const done = !ev.done;
          set((s) => ({
            events: s.events.map((e) => (e.id === id ? { ...e, done } : e)),
            tasks: ev.taskId ? s.tasks.map((t) => (t.id === ev.taskId ? { ...t, done } : t)) : s.tasks,
          }));
        },

        // ---------------- settings & ui
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setPalette: (paletteOpen) => set({ paletteOpen }),
        setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
        setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
        toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

        setAvailability: (active) => {
          discardEmptyDraft(null);
          set((s) => ({
            availability: { active, slots: active ? s.availability.slots : [] },
            selectedKey: active ? null : s.selectedKey,
            rightPanel: active && s.rightPanel === 'event' ? null : s.rightPanel,
            view: active && (s.view === 'month' || s.view === 'year' || s.view === 'agenda') ? 'week' : s.view,
          }));
        },
        addAvailabilitySlot: (slot) =>
          set((s) => {
            // merge with overlapping/adjacent slots
            let merged = { ...slot };
            const rest: AvailabilitySlot[] = [];
            for (const x of s.availability.slots) {
              if (x.start <= merged.end && merged.start <= x.end) {
                merged = { start: Math.min(x.start, merged.start), end: Math.max(x.end, merged.end) };
              } else rest.push(x);
            }
            const slots = [...rest, merged].sort((a, b) => a.start - b.start);
            return { availability: { ...s.availability, slots } };
          }),
        removeAvailabilitySlot: (i) =>
          set((s) => ({
            availability: { ...s.availability, slots: s.availability.slots.filter((_, j) => j !== i) },
          })),
        setAvailabilitySlots: (slots) => set((s) => ({ availability: { ...s.availability, slots } })),

        pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id: uid('t_') }] })),
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        pushHistory: record,
        undo: () => {
          const past = get().past;
          const prev = past[past.length - 1];
          if (!prev) {
            toast({ message: 'Niente da annullare' });
            return;
          }
          const sel = get().selectedKey;
          const stillThere = sel && prev.events.some((e) => e.id === parseOccurrenceKey(sel).id);
          set({
            ...prev,
            past: past.slice(0, -1),
            selectedKey: stillThere ? sel : null,
            rightPanel: stillThere ? get().rightPanel : get().rightPanel === 'event' ? null : get().rightPanel,
            draftId: null,
          });
        },
        resetDemo: () => {
          record();
          set({
            events: seedEvents(),
            calendars: seedCalendars(),
            tasks: seedTasks(),
            selectedKey: null,
            rightPanel: null,
          });
          toast({ message: 'Dati demo ripristinati', action: undoAction });
        },
      };
    },
    {
      name: 'orbit-calendar',
      version: 1,
      partialize: (s) => ({
        events: s.events,
        calendars: s.calendars,
        tasks: s.tasks,
        settings: s.settings,
        view: s.view,
        sidebarOpen: s.sidebarOpen,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Store>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } };
      },
    },
  ),
);

