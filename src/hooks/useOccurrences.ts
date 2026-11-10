import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getOccurrences } from '../lib/recurrence';
import type { Occurrence } from '../types';

export function useOccurrences(start: Date, end: Date): Occurrence[] {
  const events = useStore((s) => s.events);
  const calendars = useStore((s) => s.calendars);
  const showHolidays = useStore((s) => s.settings.showHolidays);
  const s = start.getTime();
  const e = end.getTime();
  return useMemo(
    () =>
      getOccurrences(
        events,
        showHolidays ? calendars : calendars.filter((c) => !c.system),
        new Date(s),
        new Date(e),
      ),
    [events, calendars, showHolidays, s, e],
  );
}

/** Non-hook accessor (for actions like auto-scheduling) */
export function occurrencesBetween(start: Date, end: Date): Occurrence[] {
  const { events, calendars, settings } = useStore.getState();
  return getOccurrences(events, settings.showHolidays ? calendars : calendars.filter((c) => !c.system), start, end);
}
