import { Coffee, MapPin, Video } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import { useNow } from '../../hooks/useNow';
import { addDays, fmtDuration, fmtRelative, fmtTime, isSameDay, MS_MIN, startOfDay } from '../../lib/date';
import { isAllDayLike } from '../../lib/layout';
import { freeSlots, slotMinutes } from '../../lib/scheduling';
import { colorHex } from '../../lib/colors';

/** "Up next" card: ongoing event with progress, countdown to the next one, free time left today */
export function UpNext() {
  const now = useNow(15_000);
  const calendars = useStore((s) => s.calendars);
  const settings = useStore((s) => s.settings);
  const select = useStore((s) => s.select);
  const setCursor = useStore((s) => s.setCursor);
  const today = startOfDay(now);
  const occs = useOccurrences(today, addDays(today, 3));
  const timed = occs.filter((o) => !isAllDayLike(o));

  const ongoing = timed.find((o) => o.start <= now && o.end > now);
  const next = timed.find((o) => o.start > now);
  const freeToday = freeSlots(occs, today, settings.workStart, settings.workEnd, 15, now).reduce(
    (a, s) => a + slotMinutes(s),
    0,
  );

  const open = (key: string, d: Date) => {
    setCursor(d);
    select(key);
  };
  const color = (calId: string, c?: string | null) =>
    colorHex((c as never) ?? calendars.find((x) => x.id === calId)?.color);

  return (
    <div className="upnext">
      {ongoing && (
        <div
          role="button"
          tabIndex={0}
          className="un-card ongoing"
          style={{ ['--c' as string]: color(ongoing.event.calendarId, ongoing.event.color) }}
          onClick={() => open(ongoing.key, ongoing.start)}
        >
          <div className="un-label">
            <span className="live-dot" /> In corso · termina tra {fmtRelative(ongoing.end.getTime() - now.getTime())}
          </div>
          <div className="un-title">{ongoing.event.title || 'Senza titolo'}</div>
          <div className="un-progress">
            <span
              style={{
                width: `${((now.getTime() - ongoing.start.getTime()) / (ongoing.end.getTime() - ongoing.start.getTime())) * 100}%`,
              }}
            />
          </div>
          {ongoing.event.meetingUrl && <JoinLink url={ongoing.event.meetingUrl} />}
        </div>
      )}
      {next ? (
        <div
          role="button"
          tabIndex={0}
          className="un-card"
          style={{ ['--c' as string]: color(next.event.calendarId, next.event.color) }}
          onClick={() => open(next.key, next.start)}
        >
          <div className="un-label">
            {isSameDay(next.start, now)
              ? `Tra ${fmtRelative(next.start.getTime() - now.getTime())}`
              : isSameDay(next.start, addDays(now, 1))
                ? `Domani alle ${fmtTime(next.start)}`
                : next.start.toLocaleDateString('it-IT', { weekday: 'long' }) + ` alle ${fmtTime(next.start)}`}
          </div>
          <div className="un-title">
            <span className="un-bar" />
            {next.event.title || 'Senza titolo'}
          </div>
          <div className="un-meta">
            {fmtTime(next.start)} – {fmtTime(next.end)}
            {next.event.location && (
              <>
                {' '}
                · <MapPin size={11} /> {next.event.location}
              </>
            )}
          </div>
          {next.event.meetingUrl && next.start.getTime() - now.getTime() < 15 * MS_MIN * 4 && (
            <JoinLink url={next.event.meetingUrl} />
          )}
        </div>
      ) : (
        !ongoing && (
          <div className="un-card empty">
            <Coffee size={16} />
            <span>Nessun altro evento in programma</span>
          </div>
        )
      )}
      <div className="un-free">
        <span>Tempo libero oggi</span>
        <b>{freeToday > 0 ? fmtDuration(freeToday) : '—'}</b>
      </div>
    </div>
  );
}

function JoinLink({ url }: { url: string }) {
  const host = url.includes('zoom') ? 'Zoom' : url.includes('teams') ? 'Teams' : url.includes('meet.google') ? 'Meet' : 'riunione';
  return (
    <a className="btn btn-join sm" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
      <Video size={13} /> Partecipa a {host}
    </a>
  );
}
