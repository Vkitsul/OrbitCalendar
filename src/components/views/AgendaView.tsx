import { CalendarCheck, MapPin, Repeat, Video } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import { useNow } from '../../hooks/useNow';
import { addDays, dateKey, diffDays, fmtDuration, fmtFullDate, fmtTime, MS_MIN, startOfDay } from '../../lib/date';
import { AGENDA_DAYS } from '../../lib/view';
import { isAllDayLike } from '../../lib/layout';
import { colorHex } from '../../lib/colors';
import { cls } from '../../lib/cls';
import type { Occurrence } from '../../types';

export function AgendaView() {
  const cursor = new Date(useStore((s) => s.cursor));
  const calendars = useStore((s) => s.calendars);
  const selectedKey = useStore((s) => s.selectedKey);
  const select = useStore((s) => s.select);
  const now = useNow();
  const start = startOfDay(cursor);
  const occs = useOccurrences(start, addDays(start, AGENDA_DAYS));

  const groups: { day: Date; items: Occurrence[] }[] = [];
  for (let i = 0; i < AGENDA_DAYS; i++) {
    const d = addDays(start, i);
    const de = addDays(d, 1);
    const items = occs.filter((o) => o.start < de && o.end > d);
    if (items.length) groups.push({ day: d, items });
  }

  const relLabel = (d: Date) => {
    const diff = diffDays(d, now);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Domani';
    if (diff === -1) return 'Ieri';
    return null;
  };

  if (!groups.length) {
    return (
      <div className="agenda empty-state">
        <CalendarCheck size={34} strokeWidth={1.4} />
        <h3>Nessun evento nei prossimi {AGENDA_DAYS} giorni</h3>
        <p>
          Premi <kbd>C</kbd> per crearne uno, oppure <kbd>Ctrl</kbd> <kbd>K</kbd> e scrivi in linguaggio naturale.
        </p>
      </div>
    );
  }

  return (
    <div className="agenda">
      {groups.map(({ day, items }) => {
        const rel = relLabel(day);
        return (
          <section key={dateKey(day)} className="ag-day">
            <header className={cls('ag-head', { today: rel === 'Oggi' })}>
              <span className="ag-num">{day.getDate()}</span>
              <span className="ag-date">
                {rel && <b>{rel} · </b>}
                {fmtFullDate(day)}
              </span>
              <span className="ag-count">
                {items.length} {items.length === 1 ? 'evento' : 'eventi'}
              </span>
            </header>
            <ul>
              {items.map((o) => {
                const cal = calendars.find((c) => c.id === o.event.calendarId);
                const color = colorHex(o.event.color ?? cal?.color);
                const ongoing = o.start <= now && o.end > now && !isAllDayLike(o);
                return (
                  <li
                    key={o.key}
                    className={cls('ag-item', { selected: selectedKey === o.key, past: o.end <= now, ongoing })}
                    onClick={() => select(o.key)}
                    style={{ ['--c' as string]: color }}
                  >
                    <div className="ag-time">
                      {isAllDayLike(o) ? (
                        <span>Tutto il giorno</span>
                      ) : (
                        <>
                          <span>{fmtTime(o.start)}</span>
                          <span className="muted">{fmtDuration((o.end.getTime() - o.start.getTime()) / MS_MIN)}</span>
                        </>
                      )}
                    </div>
                    <span className="ag-bar" />
                    <div className="ag-main">
                      <div className="ag-title">
                        {o.event.title || 'Senza titolo'}
                        {o.recurring && <Repeat size={12} className="muted" />}
                        {ongoing && <span className="pill live">In corso</span>}
                      </div>
                      <div className="ag-sub">
                        <span>{cal?.name}</span>
                        {o.event.location && (
                          <span>
                            <MapPin size={12} /> {o.event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {o.event.meetingUrl && (
                      <a
                        className="btn btn-join"
                        href={o.event.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Video size={14} /> Partecipa
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
