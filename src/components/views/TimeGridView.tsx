import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Occurrence } from '../../types';
import { useStore } from '../../store/useStore';
import { useOccurrences } from '../../hooks/useOccurrences';
import { useNow } from '../../hooks/useNow';
import { isAllDayLike, layoutAllDay, layoutDay } from '../../lib/layout';
import {
  addDays,
  dateKey,
  diffDays,
  fmtDuration,
  fmtHour,
  fmtTime,
  fmtTimeInZone,
  fmtWeekdayShort,
  isSameDay,
  isWeekend,
  localTimeZone,
  minutesOfDay,
  MS_MIN,
  setMinutesOfDay,
  startOfDay,
  tzOffsetLabel,
} from '../../lib/date';
import { cls } from '../../lib/cls';
import { dnd } from '../../lib/dnd';
import { EventChip, TimedEventBlock } from '../EventBlock';

type Drag =
  | { type: 'create'; dayIdx: number; anchorMin: number; curMin: number; moved: boolean; x0: number; y0: number }
  | { type: 'move'; occ: Occurrence; grabMs: number; start: Date; end: Date; moved: boolean; x0: number; y0: number }
  | { type: 'resize'; occ: Occurrence; end: Date; moved: boolean; x0: number; y0: number };

const SNAP = 15;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

export function TimeGridView({ days }: { days: Date[] }) {
  const settings = useStore((s) => s.settings);
  const selectedKey = useStore((s) => s.selectedKey);
  const availability = useStore((s) => s.availability);
  const select = useStore((s) => s.select);
  const createEvent = useStore((s) => s.createEvent);
  const moveOccurrence = useStore((s) => s.moveOccurrence);
  const updateSettings = useStore((s) => s.updateSettings);
  const addAvailabilitySlot = useStore((s) => s.addAvailabilitySlot);
  const removeAvailabilitySlot = useStore((s) => s.removeAvailabilitySlot);
  const scheduleTask = useStore((s) => s.scheduleTask);
  const setView = useStore((s) => s.setView);
  const setCursor = useStore((s) => s.setCursor);
  const pushToast = useStore((s) => s.pushToast);

  const hh = settings.hourHeight;
  const n = days.length;
  const daysKey = days.map(dateKey).join('|');
  const rangeStart = days[0];
  const rangeEnd = addDays(days[n - 1], 1);
  const occs = useOccurrences(rangeStart, rangeEnd);
  const now = useNow();

  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [taskGhost, setTaskGhost] = useState<{ start: Date; end: Date; title: string } | null>(null);

  const boxesByDay = useMemo(() => days.map((d) => layoutDay(occs, d)), [occs, daysKey]);
  const allDay = useMemo(() => layoutAllDay(occs, days), [occs, daysKey]);

  const dayLoad = useMemo(
    () =>
      days.map((d) => {
        const ds = startOfDay(d);
        const de = addDays(ds, 1);
        let min = 0;
        for (const o of occs) {
          if (isAllDayLike(o) || o.end <= ds || o.start >= de) continue;
          min += (Math.min(o.end.getTime(), de.getTime()) - Math.max(o.start.getTime(), ds.getTime())) / MS_MIN;
        }
        return min;
      }),
    [occs, daysKey],
  );

  // ----- initial scroll position
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const n0 = new Date();
    const hasToday = days.some((d) => isSameDay(d, n0));
    const firstEventMin = Math.min(
      ...boxesByDay.flat().map((b) => b.top),
      settings.workStart * 60,
    );
    const hour = hasToday ? n0.getHours() - 2 : firstEventMin / 60 - 0.5;
    el.scrollTop = Math.max(0, hour) * hh;
  }, [daysKey]);

  // ----- ctrl + wheel to zoom hours
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const cur = useStore.getState().settings.hourHeight;
      const next = Math.round(clamp(cur * (e.deltaY < 0 ? 1.12 : 0.9), 28, 140));
      const rect = el.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minuteAtPointer = ((el.scrollTop + offsetY) / cur) * 60;
      updateSettings({ hourHeight: next });
      requestAnimationFrame(() => {
        el.scrollTop = (minuteAtPointer / 60) * next - offsetY;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [updateSettings]);

  // ----- geometry helpers
  const pointToSlot = (clientX: number, clientY: number) => {
    const r = colsRef.current!.getBoundingClientRect();
    const dayIdx = clamp(Math.floor((clientX - r.left) / (r.width / n)), 0, n - 1);
    const min = clamp(((clientY - r.top) / hh) * 60, 0, 24 * 60);
    return { dayIdx, min };
  };
  const slotDate = (dayIdx: number, min: number) => setMinutesOfDay(days[dayIdx], min);

  const autoScroll = (clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (clientY < r.top + 40) el.scrollTop -= 12;
    else if (clientY > r.bottom - 40) el.scrollTop += 12;
  };

  const findOcc = (key: string) => occs.find((o) => o.key === key);

  // ----- pointer interactions (create / move / resize)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-nodrag]')) return;
    const evEl = target.closest<HTMLElement>('[data-key]');
    const { dayIdx, min } = pointToSlot(e.clientX, e.clientY);
    let d: Drag | null = null;
    if (evEl && !availability.active) {
      const occ = findOcc(evEl.dataset.key!);
      if (!occ) return;
      if (occ.readOnly) {
        select(occ.key);
        return;
      }
      if (target.closest('.ev-resize')) {
        d = { type: 'resize', occ, end: occ.end, moved: false, x0: e.clientX, y0: e.clientY };
      } else {
        const p = slotDate(dayIdx, min).getTime();
        d = {
          type: 'move',
          occ,
          grabMs: p - occ.start.getTime(),
          start: occ.start,
          end: occ.end,
          moved: false,
          x0: e.clientX,
          y0: e.clientY,
        };
      }
    } else {
      const m = Math.floor(min / SNAP) * SNAP;
      d = { type: 'create', dayIdx, anchorMin: m, curMin: m + SNAP, moved: false, x0: e.clientX, y0: e.clientY };
    }
    colsRef.current!.setPointerCapture(e.pointerId);
    dragRef.current = d;
    setDrag(d);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const moved = d.moved || Math.abs(e.clientX - d.x0) > 3 || Math.abs(e.clientY - d.y0) > 3;
    if (!moved) return;
    autoScroll(e.clientY);
    const { dayIdx, min } = pointToSlot(e.clientX, e.clientY);
    let next: Drag;
    if (d.type === 'create') {
      const m = min >= d.anchorMin ? Math.ceil(min / SNAP) * SNAP : Math.floor(min / SNAP) * SNAP;
      next = { ...d, moved, curMin: m };
    } else if (d.type === 'move') {
      const dur = d.occ.end.getTime() - d.occ.start.getTime();
      const raw = new Date(slotDate(dayIdx, min).getTime() - d.grabMs);
      const start = d.occ.event.allDay ? startOfDay(raw) : setMinutesOfDay(raw, snap(minutesOfDay(raw)));
      next = { ...d, moved, start, end: new Date(start.getTime() + dur) };
    } else {
      const p = slotDate(dayIdx, snap(min)).getTime();
      next = { ...d, moved, end: new Date(Math.max(p, d.occ.start.getTime() + SNAP * MS_MIN)) };
    }
    dragRef.current = next;
    setDrag(next);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const st = useStore.getState();
    if (d.type === 'create') {
      const a = Math.min(d.anchorMin, d.curMin);
      const b = Math.max(d.anchorMin, d.curMin, a + SNAP);
      const start = slotDate(d.dayIdx, a);
      if (availability.active) {
        const end = d.moved ? slotDate(d.dayIdx, b) : slotDate(d.dayIdx, a + 60);
        addAvailabilitySlot({ start: start.getTime(), end: end.getTime() });
        return;
      }
      if (!d.moved) {
        if (st.selectedKey) {
          select(null);
          return;
        }
        const end = new Date(start.getTime() + settings.defaultDuration * MS_MIN);
        createEvent({ start: start.toISOString(), end: end.toISOString() }, { draft: true });
      } else {
        createEvent({ start: start.toISOString(), end: slotDate(d.dayIdx, b).toISOString() }, { draft: true });
      }
    } else if (d.type === 'move') {
      if (!d.moved) {
        select(d.occ.key);
        return;
      }
      if (d.start.getTime() !== d.occ.start.getTime()) moveOccurrence(d.occ.key, d.start, d.end);
    } else if (d.moved && d.end.getTime() !== d.occ.end.getTime()) {
      moveOccurrence(d.occ.key, d.occ.start, d.end);
    }
  };

  // ----- task drag & drop from the sidebar
  const onDragOver = (e: React.DragEvent) => {
    const p = dnd.get();
    if (!p || p.kind !== 'task') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const { dayIdx, min } = pointToSlot(e.clientX, e.clientY);
    const start = slotDate(dayIdx, Math.floor(min / SNAP) * SNAP);
    if (!taskGhost || taskGhost.start.getTime() !== start.getTime()) {
      setTaskGhost({ start, end: new Date(start.getTime() + p.duration * MS_MIN), title: p.title });
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const p = dnd.get();
    if (!p || p.kind !== 'task' || !taskGhost) return;
    e.preventDefault();
    const id = scheduleTask(p.id, taskGhost.start);
    dnd.clear();
    setTaskGhost(null);
    if (id) {
      pushToast({
        message: `“${p.title}” pianificata ${fmtTime(taskGhost.start)}–${fmtTime(taskGhost.end)}`,
        tone: 'success',
        action: { label: 'Annulla', run: () => useStore.getState().undo() },
      });
    }
  };

  // ----- ghost (preview) segments
  type Ghost = { start: Date; end: Date; title: string; kind: 'create' | 'move' | 'task'; color?: string };
  let ghost: Ghost | null = null;
  if (drag?.moved || (drag?.type === 'create' && drag.moved)) {
    if (drag.type === 'create') {
      const a = Math.min(drag.anchorMin, drag.curMin);
      const b = Math.max(drag.anchorMin, drag.curMin, a + SNAP);
      ghost = { start: slotDate(drag.dayIdx, a), end: slotDate(drag.dayIdx, b), title: availability.active ? 'Disponibile' : 'Nuovo evento', kind: 'create' };
    } else if (drag.type === 'move') {
      ghost = { start: drag.start, end: drag.end, title: drag.occ.event.title, kind: 'move' };
    } else {
      ghost = { start: drag.occ.start, end: drag.end, title: drag.occ.event.title, kind: 'move' };
    }
  } else if (taskGhost) {
    ghost = { ...taskGhost, kind: 'task' };
  }
  const draggingKey = drag && drag.type !== 'create' && drag.moved ? drag.occ.key : null;

  const segmentFor = (start: Date, end: Date, day: Date) => {
    const ds = startOfDay(day);
    const de = addDays(ds, 1);
    if (end <= ds || start >= de) return null;
    const s = start < ds ? ds : start;
    const e = end > de ? de : end;
    const top = ((s.getTime() - ds.getTime()) / MS_MIN / 60) * hh;
    const height = Math.max(((e.getTime() - s.getTime()) / MS_MIN / 60) * hh, 12);
    return { top, height };
  };

  const isToday = (d: Date) => isSameDay(d, now);
  const nowTop = (minutesOfDay(now) / 60) * hh;
  const todayIdx = days.findIndex(isToday);
  const tz2 = settings.secondaryTz;
  const workSpan = (settings.workEnd - settings.workStart) * 60;

  // ----- all-day lane interactions
  const allDayRef = useRef<HTMLDivElement>(null);
  const allDayIdx = (clientX: number) => {
    const r = allDayRef.current!.getBoundingClientRect();
    return clamp(Math.floor((clientX - r.left) / (r.width / n)), 0, n - 1);
  };
  const lanes = Math.max(allDay.lanes, 1);

  return (
    <div className={cls('tg', { 'with-tz2': !!tz2 })} style={{ ['--n' as string]: n, ['--hh' as string]: `${hh}px` }}>
      {/* header */}
      <div className="tg-head">
        <div className="tg-gutter-head">
          {tz2 ? (
            <>
              <span title={tz2}>{tzOffsetLabel(tz2)}</span>
              <span title={localTimeZone()}>{tzOffsetLabel(localTimeZone())}</span>
            </>
          ) : (
            <span title={localTimeZone()}>{tzOffsetLabel(localTimeZone())}</span>
          )}
        </div>
        <div className="tg-days">
          {days.map((d, i) => {
            const load = dayLoad[i];
            const ratio = Math.min(load / Math.max(workSpan, 60), 1.2);
            const tone = ratio > 0.85 ? 'high' : ratio > 0.5 ? 'mid' : 'low';
            return (
              <button
                key={i}
                className={cls('tg-dayhead', { today: isToday(d), weekend: isWeekend(d), past: d < startOfDay(now) })}
                onClick={() => {
                  setCursor(d);
                  setView('day');
                }}
                title={`${fmtDuration(load)} pianificate`}
              >
                <span className="dow">{fmtWeekdayShort(d)}</span>
                <span className="dnum">{d.getDate()}</span>
                {load > 0 && (
                  <span className="load" data-tone={tone}>
                    <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* all-day lane */}
      <div className="tg-allday">
        <div className="tg-gutter-head small">
          <span>Giornata</span>
        </div>
        <div
          ref={allDayRef}
          className="tg-allday-area"
          style={{ height: lanes * 24 + 8 }}
          onDragStart={(e) => {
            const p = dnd.get();
            if (p?.kind === 'occ') dnd.set({ ...p, fromDay: days[allDayIdx(e.clientX)].getTime() });
          }}
          onDragOver={(e) => {
            if (dnd.get()?.kind === 'occ') e.preventDefault();
          }}
          onDrop={(e) => {
            const p = dnd.get();
            if (p?.kind !== 'occ') return;
            e.preventDefault();
            const target = days[allDayIdx(e.clientX)];
            const delta = diffDays(target, new Date(p.fromDay));
            const o = findOcc(p.key);
            dnd.clear();
            if (!o || !delta) return;
            moveOccurrence(o.key, addDays(o.start, delta), addDays(o.end, delta));
          }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-key]')) return;
            if (useStore.getState().selectedKey) return select(null);
            const d = days[allDayIdx(e.clientX)];
            createEvent(
              { start: startOfDay(d).toISOString(), end: addDays(startOfDay(d), 1).toISOString(), allDay: true },
              { draft: true },
            );
          }}
        >
          {days.map((d, i) => (
            <div key={i} className={cls('tg-allday-cell', { weekend: isWeekend(d) })} style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }} />
          ))}
          {allDay.boxes.map((b) => (
            <EventChip
              key={b.occ.key}
              occ={b.occ}
              variant="allday"
              selected={selectedKey === b.occ.key}
              past={settings.dimPast && b.occ.end <= now}
              dayForDrag={days[b.startIdx]}
              contBefore={b.occ.start < startOfDay(days[b.startIdx])}
              contAfter={b.occ.end > addDays(days[b.endIdx], 1)}
              onClick={(e) => {
                e.stopPropagation();
                select(b.occ.key);
              }}
              style={{
                position: 'absolute',
                top: b.lane * 24 + 4,
                left: `calc(${(b.startIdx / n) * 100}% + 3px)`,
                width: `calc(${((b.endIdx - b.startIdx + 1) / n) * 100}% - 6px)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* scrolling time grid */}
      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-body" style={{ height: 24 * hh }}>
          <div className="tg-gutter">
            {Array.from({ length: 24 }, (_, h) =>
              h === 0 ? null : (
                <div key={h} className="tg-hour" style={{ top: h * hh }}>
                  {tz2 && <span className="tz2">{fmtTimeInZone(setMinutesOfDay(days[0], h * 60), tz2)}</span>}
                  <span>{fmtHour(h)}</span>
                </div>
              ),
            )}
            {todayIdx >= 0 && (
              <div className="tg-now-label" style={{ top: nowTop }}>
                {fmtTime(now)}
              </div>
            )}
          </div>

          <div
            className={cls('tg-cols', { 'avail-mode': availability.active, dragging: !!drag?.moved })}
            ref={colsRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDragOver={onDragOver}
            onDragLeave={(e) => {
              if (!colsRef.current?.contains(e.relatedTarget as Node)) setTaskGhost(null);
            }}
            onDrop={onDrop}
          >
            {todayIdx >= 0 && <div className="tg-now-faint" style={{ top: nowTop }} />}
            {days.map((d, i) => {
              const weekend = isWeekend(d);
              return (
                <div key={i} className={cls('tg-col', { weekend, today: isToday(d) })}>
                  {!weekend && (
                    <>
                      <div className="offhours" style={{ top: 0, height: settings.workStart * hh }} />
                      <div className="offhours" style={{ top: settings.workEnd * hh, bottom: 0 }} />
                    </>
                  )}

                  {boxesByDay[i].map((b) => {
                    const top = (b.top / 60) * hh;
                    const heightPx = Math.max((b.height / 60) * hh - 2, 14);
                    return (
                      <TimedEventBlock
                        key={b.occ.key}
                        occ={b.occ}
                        heightPx={heightPx}
                        selected={selectedKey === b.occ.key}
                        past={settings.dimPast && b.occ.end <= now}
                        dragging={draggingKey === b.occ.key}
                        continuesBefore={b.continuesBefore}
                        continuesAfter={b.continuesAfter}
                        style={{
                          top: top + 1,
                          height: heightPx,
                          left: `calc(${b.left * 100}% + 2px)`,
                          width: `calc(${b.width * 100}% - ${b.left + b.width < 0.999 ? 2 : 6}px)`,
                          zIndex: 1 + b.z,
                        }}
                      />
                    );
                  })}

                  {availability.slots.map((sl, si) => {
                    const seg = segmentFor(new Date(sl.start), new Date(sl.end), d);
                    if (!seg) return null;
                    return (
                      <div key={si} className="avail-slot" style={{ top: seg.top, height: seg.height }}>
                        <span>
                          {fmtTime(new Date(sl.start))} – {fmtTime(new Date(sl.end))}
                        </span>
                        <button data-nodrag onClick={() => removeAvailabilitySlot(si)} aria-label="Rimuovi slot">
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {ghost &&
                    (() => {
                      const seg = segmentFor(ghost.start, ghost.end, d);
                      if (!seg) return null;
                      return (
                        <div
                          className={cls('ev-ghost', `ghost-${ghost.kind}`, { avail: availability.active })}
                          style={{ top: seg.top + 1, height: seg.height - 2 }}
                        >
                          <div className="ev-title">{ghost.title || 'Senza titolo'}</div>
                          <div className="ev-meta">
                            {fmtTime(ghost.start)} – {fmtTime(ghost.end)} ·{' '}
                            {fmtDuration((ghost.end.getTime() - ghost.start.getTime()) / MS_MIN)}
                          </div>
                        </div>
                      );
                    })()}

                  {isToday(d) && (
                    <div className="tg-now" style={{ top: nowTop }}>
                      <span />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
