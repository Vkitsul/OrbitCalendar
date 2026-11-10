import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import { useNow } from '../../hooks/useNow';
import { monthGrid } from '../../lib/view';
import {
  addDays,
  addMinutes,
  dateKey,
  diffDays,
  fmtMonthShort,
  fmtWeekdayShort,
  isoWeek,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfDay,
} from '../../lib/date';
import { isAllDayLike } from '../../lib/layout';
import { cls } from '../../lib/cls';
import { dnd } from '../../lib/dnd';
import { EventChip } from '../EventBlock';
import { freeSlots } from '../../lib/scheduling';

const CHIP_H = 22;

export function MonthView() {
  const cursorMs = useStore((s) => s.cursor);
  const settings = useStore((s) => s.settings);
  const selectedKey = useStore((s) => s.selectedKey);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const setCursor = useStore((s) => s.setCursor);
  const createEvent = useStore((s) => s.createEvent);
  const moveOccurrence = useStore((s) => s.moveOccurrence);
  const scheduleTask = useStore((s) => s.scheduleTask);
  const pushToast = useStore((s) => s.pushToast);
  const now = useNow();

  const cursor = new Date(cursorMs);
  const days = monthGrid(cursor, settings);
  const cols = settings.hideWeekends ? 5 : 7;
  const rows = Math.ceil(days.length / cols);
  const occs = useOccurrences(days[0], addDays(days[days.length - 1], 1));

  const byDay = useMemo(() => {
    const map = new Map<string, typeof occs>();
    for (const d of days) {
      const ds = startOfDay(d);
      const de = addDays(ds, 1);
      const list = occs.filter((o) => o.start < de && o.end > ds);
      list.sort((a, b) => {
        const ad = isAllDayLike(a) ? 0 : 1;
        const bd = isAllDayLike(b) ? 0 : 1;
        return ad - bd || a.start.getTime() - b.start.getTime();
      });
      map.set(dateKey(d), list);
    }
    return map;
  }, [occs, days.length, days[0]?.getTime()]);

  const gridRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(3);
  const [dropKey, setDropKey] = useState<string | null>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cellH = el.clientHeight / rows;
      setCapacity(Math.max(1, Math.floor((cellH - 30) / CHIP_H)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows]);

  const handleDrop = (e: React.DragEvent, day: Date) => {
    const p = dnd.get();
    setDropKey(null);
    if (!p) return;
    e.preventDefault();
    dnd.clear();
    if (p.kind === 'occ') {
      const o = occs.find((x) => x.key === p.key);
      const delta = diffDays(day, new Date(p.fromDay));
      if (o && delta) moveOccurrence(o.key, addDays(o.start, delta), addDays(o.end, delta));
    } else {
      const dayOccs = byDay.get(dateKey(day)) ?? [];
      const slot = freeSlots(dayOccs, day, settings.workStart, settings.workEnd, p.duration)[0];
      const start = slot?.start ?? addMinutes(startOfDay(day), settings.workStart * 60);
      scheduleTask(p.id, start);
      pushToast({
        message: `“${p.title}” pianificata ${slot ? 'nel primo slot libero' : ''}`,
        tone: 'success',
        action: { label: 'Annulla', run: () => useStore.getState().undo() },
      });
    }
  };

  return (
    <div className="mv" style={{ ['--cols' as string]: cols }}>
      <div className="mv-head">
        {days.slice(0, cols).map((d, i) => (
          <div key={i} className={cls('mv-dow', { weekend: isWeekend(d) })}>
            {fmtWeekdayShort(d)}
          </div>
        ))}
      </div>
      <div className="mv-grid" ref={gridRef} style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {days.map((d, i) => {
          const k = dateKey(d);
          const list = byDay.get(k) ?? [];
          const overflow = list.length > capacity;
          const shown = overflow ? list.slice(0, capacity - 1) : list;
          const today = isSameDay(d, now);
          return (
            <div
              key={k}
              className={cls('mv-cell', {
                outside: !isSameMonth(d, cursor),
                weekend: isWeekend(d),
                today,
                past: d < startOfDay(now),
                droptarget: dropKey === k,
              })}
              onDragOver={(e) => {
                if (!dnd.get()) return;
                e.preventDefault();
                if (dropKey !== k) setDropKey(k);
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropKey(null);
              }}
              onDrop={(e) => handleDrop(e, d)}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-key],button')) return;
                if (useStore.getState().selectedKey) select(null);
              }}
              onDoubleClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-key],button')) return;
                createEvent(
                  { start: startOfDay(d).toISOString(), end: addDays(startOfDay(d), 1).toISOString(), allDay: true },
                  { draft: true },
                );
              }}
            >
              <div className="mv-cell-head">
                {settings.showWeekNumbers && i % cols === 0 && <span className="mv-week">S{isoWeek(d)}</span>}
                <button
                  className="mv-daynum"
                  onClick={() => {
                    setCursor(d);
                    setView('day');
                  }}
                >
                  {d.getDate() === 1 ? `${d.getDate()} ${fmtMonthShort(d)}` : d.getDate()}
                </button>
              </div>
              <div className="mv-events">
                {shown.map((o) => (
                  <EventChip
                    key={o.key}
                    occ={o}
                    variant={isAllDayLike(o) ? 'allday' : 'timed'}
                    selected={selectedKey === o.key}
                    past={settings.dimPast && o.end <= now}
                    dayForDrag={d}
                    contBefore={isAllDayLike(o) && o.start < startOfDay(d)}
                    contAfter={isAllDayLike(o) && o.end > addDays(startOfDay(d), 1)}
                    onClick={(e) => {
                      e.stopPropagation();
                      select(o.key);
                    }}
                  />
                ))}
                {overflow && (
                  <button
                    className="mv-more"
                    onClick={() => {
                      setCursor(d);
                      setView('day');
                    }}
                  >
                    +{list.length - shown.length} altri
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
