import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import { useNow } from '../../hooks/useNow';
import {
  addDays,
  dateKey,
  fmtDuration,
  fmtMediumDate,
  fmtMonthLong,
  isSameDay,
  MS_MIN,
  startOfDay,
  startOfWeek,
} from '../../lib/date';
import { isAllDayLike } from '../../lib/layout';
import { holidayName } from '../../lib/recurrence';
import { cls } from '../../lib/cls';

const level = (min: number, count: number) => {
  if (!count) return 0;
  if (min >= 360) return 4;
  if (min >= 210) return 3;
  if (min >= 90) return 2;
  return 1;
};

export function YearView() {
  const cursorMs = useStore((s) => s.cursor);
  const settings = useStore((s) => s.settings);
  const setCursor = useStore((s) => s.setCursor);
  const setView = useStore((s) => s.setView);
  const now = useNow(60_000);
  const year = new Date(cursorMs).getFullYear();
  const yStart = new Date(year, 0, 1);
  const yEnd = new Date(year + 1, 0, 1);
  const occs = useOccurrences(yStart, yEnd);

  const stats = useMemo(() => {
    const m = new Map<string, { min: number; count: number }>();
    const ys = new Date(year, 0, 1);
    const ye = new Date(year + 1, 0, 1);
    for (const o of occs) {
      if (o.readOnly) continue;
      let d = startOfDay(o.start < ys ? ys : o.start);
      while (d < o.end && d < ye) {
        const de = addDays(d, 1);
        const k = dateKey(d);
        const cur = m.get(k) ?? { min: 0, count: 0 };
        cur.count++;
        if (!isAllDayLike(o)) {
          cur.min += (Math.min(o.end.getTime(), de.getTime()) - Math.max(o.start.getTime(), d.getTime())) / MS_MIN;
        }
        m.set(k, cur);
        d = de;
      }
    }
    return m;
  }, [occs, year]);

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
  const dows = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now, settings.weekStartsOn), i));

  return (
    <div className="yv">
      <div className="yv-grid">
        {months.map((m) => {
          const start = startOfWeek(m, settings.weekStartsOn);
          const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
          const isCurrent = m.getMonth() === now.getMonth() && year === now.getFullYear();
          return (
            <div key={m.getMonth()} className={cls('yv-month', { current: isCurrent })}>
              <button
                className="yv-title"
                onClick={() => {
                  setCursor(m);
                  setView('month');
                }}
              >
                {fmtMonthLong(m)}
              </button>
              <div className="yv-dows">
                {dows.map((d, i) => (
                  <span key={i}>{d.toLocaleDateString('it-IT', { weekday: 'narrow' })}</span>
                ))}
              </div>
              <div className="yv-days">
                {cells.map((d, i) => {
                  if (d.getMonth() !== m.getMonth()) return <span key={i} className="yv-day empty" />;
                  const st = stats.get(dateKey(d));
                  const hol = settings.showHolidays ? holidayName(d) : null;
                  const lv = level(st?.min ?? 0, st?.count ?? 0);
                  const summary = st
                    ? `${st.count} ${st.count === 1 ? 'evento' : 'eventi'}${st.min ? ` · ${fmtDuration(st.min)}` : ''}`
                    : 'Libero';
                  return (
                    <button
                      key={i}
                      className={cls('yv-day', `lv${lv}`, { today: isSameDay(d, now), holiday: !!hol })}
                      title={[fmtMediumDate(d), hol, summary].filter(Boolean).join('\n')}
                      onClick={() => {
                        setCursor(d);
                        setView('day');
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="yv-legend">
        <span>Meno impegnato</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`yv-swatch lv${l}`} />
        ))}
        <span>Più impegnato</span>
        <span className="sep" />
        <i className="yv-swatch holiday" />
        <span>Festività</span>
      </div>
    </div>
  );
}
