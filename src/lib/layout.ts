import type { Occurrence } from '../types';
import { addDays, MS_DAY, MS_MIN, startOfDay } from './date';

export interface TimedBox {
  occ: Occurrence;
  /** minutes from day start */
  top: number;
  /** minutes */
  height: number;
  /** horizontal placement as fractions of the day column */
  left: number;
  width: number;
  z: number;
  stacked: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Events shown in the all-day lane: all-day ones and timed ones lasting 24h+ */
export const isAllDayLike = (o: Occurrence) =>
  o.event.allDay || o.end.getTime() - o.start.getTime() >= MS_DAY;

const MIN_VISUAL = 22; // minutes – keeps tiny events clickable & overlap-aware
const STACK_GAP = 30; // an event starting this much later than everything it overlaps is stacked, not squeezed
const INDENT = 0.14;

/**
 * Google-Calendar-like layout:
 *  - events starting close together are placed side by side (columns, expanded to the right when free)
 *  - an event starting 30+ minutes after the ones it overlaps is stacked on top with an indent,
 *    so long blocks keep their full width.
 */
export function layoutDay(occs: Occurrence[], day: Date): TimedBox[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  type Item = TimedBox & { visEnd: number; col: number; parent: Item | null };

  const items: Item[] = occs
    .filter((o) => !isAllDayLike(o) && o.start < dayEnd && o.end > dayStart)
    .map((occ) => {
      const s = occ.start < dayStart ? dayStart : occ.start;
      const e = occ.end > dayEnd ? dayEnd : occ.end;
      const top = (s.getTime() - dayStart.getTime()) / MS_MIN;
      const height = Math.max((e.getTime() - s.getTime()) / MS_MIN, 1);
      return {
        occ,
        top,
        height,
        visEnd: top + Math.max(height, MIN_VISUAL),
        left: 0,
        width: 1,
        z: 1,
        col: 0,
        stacked: false,
        parent: null,
        continuesBefore: occ.start < dayStart,
        continuesAfter: occ.end > dayEnd,
      };
    })
    .sort((a, b) => a.top - b.top || b.height - a.height);

  // pass 1 – decide which events are stacked
  items.forEach((it, i) => {
    const earlier = items.slice(0, i).filter((j) => j.visEnd > it.top);
    if (earlier.length && earlier.every((j) => it.top - j.top >= STACK_GAP)) {
      it.stacked = true;
      it.parent = earlier.reduce((a, b) => (b.top >= a.top ? b : a));
    }
  });

  // pass 2 – side-by-side columns for the non-stacked ones
  const flat = items.filter((it) => !it.stacked);
  let cluster: Item[] = [];
  let columns: Item[][] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = columns.length;
    for (const it of cluster) {
      let span = 1;
      for (let c = it.col + 1; c < n; c++) {
        if (columns[c].some((o) => o.top < it.visEnd && it.top < o.visEnd)) break;
        span++;
      }
      it.left = it.col / n;
      it.width = span / n;
      it.z = 1 + it.col;
    }
    cluster = [];
    columns = [];
    clusterEnd = -1;
  };
  for (const it of flat) {
    if (cluster.length && it.top >= clusterEnd) flush();
    let c = columns.findIndex((col) => col[col.length - 1].visEnd <= it.top);
    if (c === -1) {
      c = columns.length;
      columns.push([it]);
    } else columns[c].push(it);
    it.col = c;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.visEnd);
  }
  if (cluster.length) flush();

  // pass 3 – stacked ones, indented over their parent
  for (const it of items) {
    if (!it.stacked || !it.parent) continue;
    const p = it.parent;
    const indent = Math.min(INDENT, p.width * 0.3);
    it.left = p.left + indent;
    it.width = Math.max(p.left + p.width - it.left, 0.2);
    it.z = p.z + 1;
  }

  return items.map(({ visEnd: _v, col: _c, parent: _p, ...rest }) => rest);
}

export interface AllDayBox {
  occ: Occurrence;
  startIdx: number;
  endIdx: number;
  lane: number;
}

export function layoutAllDay(occs: Occurrence[], days: Date[]): { boxes: AllDayBox[]; lanes: number } {
  const boxes: AllDayBox[] = [];
  for (const occ of occs) {
    if (!isAllDayLike(occ)) continue;
    let s = -1;
    let e = -1;
    days.forEach((d, i) => {
      const ds = startOfDay(d);
      const de = addDays(ds, 1);
      if (occ.start < de && occ.end > ds) {
        if (s === -1) s = i;
        e = i;
      }
    });
    if (s !== -1) boxes.push({ occ, startIdx: s, endIdx: e, lane: 0 });
  }
  boxes.sort((a, b) => a.startIdx - b.startIdx || b.endIdx - b.startIdx - (a.endIdx - a.startIdx));
  const laneEnds: number[] = [];
  for (const b of boxes) {
    let lane = laneEnds.findIndex((end) => end < b.startIdx);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endIdx);
    } else laneEnds[lane] = b.endIdx;
    b.lane = lane;
  }
  return { boxes, lanes: laneEnds.length };
}
