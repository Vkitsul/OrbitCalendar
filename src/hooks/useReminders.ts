import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { occurrencesBetween } from './useOccurrences';
import { fmtTime, MS_MIN } from '../lib/date';
import { isAllDayLike } from '../lib/layout';
import { desktop } from '../lib/desktop';

/** In-app reminder 5 minutes before timed events (with a quick "join" action) */
export function useReminders() {
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const check = () => {
      const s = useStore.getState();
      if (!s.settings.remindersEnabled) return;
      const now = new Date();
      const soon = new Date(now.getTime() + 5 * MS_MIN);
      for (const o of occurrencesBetween(now, soon)) {
        if (isAllDayLike(o) || o.start < now || o.start > soon || o.event.done) continue;
        if (notified.current.has(o.key)) continue;
        notified.current.add(o.key);
        const url = o.event.meetingUrl;
        notifyNative(o.event.title || 'Evento', `Alle ${fmtTime(o.start)}${o.event.location ? ` · ${o.event.location}` : ''}`, () => {
          s.setCursor(o.start);
          s.select(o.key);
        });
        s.pushToast({
          tone: 'reminder',
          message: `${o.event.title || 'Evento'} alle ${fmtTime(o.start)}`,
          action: url ? { label: 'Partecipa', run: () => window.open(url, '_blank', 'noopener') } : undefined,
          secondary: { label: 'Apri', run: () => (s.setCursor(o.start), s.select(o.key)) },
        });
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
}

/** Windows notification (desktop app) or browser notification when allowed */
function notifyNative(title: string, body: string, onClick: () => void) {
  if (typeof Notification === 'undefined') return;
  if (!desktop && Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, silent: false });
    n.onclick = () => {
      desktop?.focusWindow();
      window.focus();
      onClick();
    };
  } catch {
    /* notifications unavailable */
  }
}
