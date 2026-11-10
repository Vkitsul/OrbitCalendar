export type ViewType = 'day' | '3day' | 'week' | 'month' | 'agenda' | 'year';

export type ColorKey =
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'gray';

export type Freq = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface Recurrence {
  freq: Freq;
  /** dateKey (YYYY-MM-DD) of the last allowed occurrence */
  until?: string | null;
  /** dateKeys of skipped occurrences */
  exdates?: string[];
}

export type EventKind = 'event' | 'focus' | 'task';

export interface CalEvent {
  id: string;
  title: string;
  /** ISO string. For all-day events: local midnight of the first day */
  start: string;
  /** ISO string. Exclusive end. For all-day events: local midnight after the last day */
  end: string;
  allDay: boolean;
  calendarId: string;
  color?: ColorKey | null;
  location?: string;
  description?: string;
  meetingUrl?: string;
  attendees?: string[];
  recurrence?: Recurrence | null;
  kind?: EventKind;
  taskId?: string;
  done?: boolean;
  createdAt: number;
}

export interface CalendarSource {
  id: string;
  name: string;
  color: ColorKey;
  visible: boolean;
  /** built-in generated calendars (e.g. holidays) */
  system?: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** minutes */
  duration: number;
  calendarId: string;
  done: boolean;
  scheduledEventId?: string | null;
  priority?: 0 | 1 | 2;
  createdAt: number;
}

export interface Settings {
  theme: 'system' | 'dark' | 'light';
  accent: ColorKey;
  weekStartsOn: 0 | 1;
  hideWeekends: boolean;
  showWeekNumbers: boolean;
  workStart: number;
  workEnd: number;
  hourHeight: number;
  secondaryTz: string | null;
  defaultDuration: number;
  showHolidays: boolean;
  dimPast: boolean;
  remindersEnabled: boolean;
}

/** A concrete instance of an event on the calendar (recurring events expand to many) */
export interface Occurrence {
  key: string;
  event: CalEvent;
  start: Date;
  end: Date;
  recurring: boolean;
  /** dateKey of the occurrence (for recurring events) */
  occDate?: string;
  /** generated read-only events (holidays) */
  readOnly?: boolean;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}
