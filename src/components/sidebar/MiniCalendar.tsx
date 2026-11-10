import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import {
  addDays,
  addMonths,
  dateKey,
  fmtMonthYear,
  isoWeek,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../../lib/date';
import { viewRange } from '../../lib/view';
import { cls } from '../../lib/cls';
import { useNow } from '../../hooks/useNow';

export function MiniCalendar() {
  const cursorMs = useStore((s) => s.cursor);
  const view = useStore((s) => s.view);
  const settings = useStore((s) => s.settings);
  const setCursor = useStore((s) => s.setCursor);
  const now = useNow(60_000);
  const cursor = new Date(cursorMs);
  const [month, setMonth] = useState(() => startOfMonth(cursor));

  useEffect(() => {
    setMonth(startOfMonth(new Date(cursorMs)));
  }, [cursorMs]);

  const start = startOfWeek(month, settings.weekStartsOn);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const occs = useOccurrences(days[0], addDays(days[41], 1));

  const busy = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of occs) {
      if (o.readOnly) continue;
      let d = startOfDay(o.start);
      while (d < o.end) {
        const k = dateKey(d);
        m.set(k, (m.get(k) ?? 0) + 1);
        d = addDays(d, 1);
      }
    }
    return m;
  }, [occs]);

  const range = view === 'year' || view === 'agenda' ? null : viewRange(view, cursor, settings);
  const inRange = (d: Date) => !!range && d >= range.start && d < range.end;

  return (
    <div className="mini">
      <div className="mini-head">
        <span className="mini-title">{fmtMonthYear(month)}</span>
        <div className="mini-nav">
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente">
            <ChevronLeft size={15} />
          </button>
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className={cls('mini-grid', { 'with-weeks': settings.showWeekNumbers })}>
        {settings.showWeekNumbers && <span className="mini-dow" />}
        {days.slice(0, 7).map((d, i) => (
          <span key={i} className="mini-dow">
            {d.toLocaleDateString('it-IT', { weekday: 'narrow' })}
          </span>
        ))}
        {days.map((d, i) => {
          const count = busy.get(dateKey(d)) ?? 0;
          return (
            <FragmentRow key={i} showWeek={settings.showWeekNumbers && i % 7 === 0} week={isoWeek(d)}>
              <button
                className={cls('mini-day', {
                  outside: !isSameMonth(d, month),
                  today: isSameDay(d, now),
                  selected: isSameDay(d, cursor),
                  inrange: inRange(d),
                  rstart: !!range && isSameDay(d, range.start),
                  rend: !!range && isSameDay(addDays(d, 1), range.end),
                })}
                onClick={() => setCursor(d)}
              >
                {d.getDate()}
                {count > 0 && <i className={cls('mini-dot', { many: count > 3 })} />}
              </button>
            </FragmentRow>
          );
        })}
      </div>
    </div>
  );
}

function FragmentRow({ showWeek, week, children }: { showWeek: boolean; week: number; children: React.ReactNode }) {
  return (
    <>
      {showWeek && <span className="mini-week">{week}</span>}
      {children}
    </>
  );
}
