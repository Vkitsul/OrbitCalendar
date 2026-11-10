import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Lightbulb, Target, TriangleAlert, WandSparkles, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useOccurrences } from '../hooks/useOccurrences';
import {
  addDays,
  fmtDayMonth,
  fmtDuration,
  fmtWeekdayLong,
  fmtWeekdayShort,
  isoWeek,
  isSameDay,
  isWeekend,
  MS_MIN,
  setMinutesOfDay,
  startOfDay,
  startOfWeek,
} from '../lib/date';
import { isAllDayLike } from '../lib/layout';
import { freeSlots, slotMinutes } from '../lib/scheduling';
import { colorHex } from '../lib/colors';
import { cls } from '../lib/cls';
import { autoScheduleTasks, protectFocusTime } from '../lib/actions';
import type { Occurrence } from '../types';

const minutesIn = (o: Occurrence, s: Date, e: Date) =>
  Math.max(0, (Math.min(o.end.getTime(), e.getTime()) - Math.max(o.start.getTime(), s.getTime())) / MS_MIN);

const isMeeting = (o: Occurrence) => !!o.event.meetingUrl || (o.event.attendees?.length ?? 0) > 0;
const isFocus = (o: Occurrence, focusCalIds: Set<string>) => o.event.kind === 'focus' || focusCalIds.has(o.event.calendarId);

export function InsightsPanel() {
  const cursor = new Date(useStore((s) => s.cursor));
  const settings = useStore((s) => s.settings);
  const calendars = useStore((s) => s.calendars);
  const tasks = useStore((s) => s.tasks);
  const toggleInsights = useStore((s) => s.toggleInsights);

  const weekStart = startOfWeek(cursor, settings.weekStartsOn);
  const weekEnd = addDays(weekStart, 7);
  const prevStart = addDays(weekStart, -7);
  const all = useOccurrences(prevStart, weekEnd);
  const now = new Date();

  const data = useMemo(() => {
    const timed = all.filter((o) => !isAllDayLike(o) && !o.readOnly);
    const inWeek = timed.filter((o) => o.start < weekEnd && o.end > weekStart);
    const inPrev = timed.filter((o) => o.start < weekStart && o.end > prevStart);
    const focusCalIds = new Set(calendars.filter((c) => /focus/i.test(c.name)).map((c) => c.id));

    const total = inWeek.reduce((a, o) => a + minutesIn(o, weekStart, weekEnd), 0);
    const prevTotal = inPrev.reduce((a, o) => a + minutesIn(o, prevStart, weekStart), 0);
    const meeting = inWeek.filter(isMeeting).reduce((a, o) => a + minutesIn(o, weekStart, weekEnd), 0);
    const focus = inWeek.filter((o) => isFocus(o, focusCalIds)).reduce((a, o) => a + minutesIn(o, weekStart, weekEnd), 0);

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const perDay = days.map((d) => {
      const de = addDays(d, 1);
      return inWeek.reduce((a, o) => a + minutesIn(o, d, de), 0);
    });
    const meetingPerDay = days.map((d) => {
      const de = addDays(d, 1);
      return inWeek.filter(isMeeting).reduce((a, o) => a + minutesIn(o, d, de), 0);
    });

    const perCal = calendars
      .filter((c) => !c.system)
      .map((c) => ({
        cal: c,
        min: inWeek.filter((o) => o.event.calendarId === c.id).reduce((a, o) => a + minutesIn(o, weekStart, weekEnd), 0),
      }))
      .filter((x) => x.min > 0)
      .sort((a, b) => b.min - a.min);

    // free working time left this week (weekdays, from now)
    let freeLeft = 0;
    const noBigSlotDays: Date[] = [];
    for (const d of days) {
      if (isWeekend(d) || setMinutesOfDay(d, settings.workEnd * 60) <= now) continue;
      const slots = freeSlots(inWeek, d, settings.workStart, settings.workEnd, 15, now);
      freeLeft += slots.reduce((a, s) => a + slotMinutes(s), 0);
      if (!slots.some((s) => slotMinutes(s) >= 90)) noBigSlotDays.push(d);
    }

    // overlapping pairs
    const conflicts: [Occurrence, Occurrence][] = [];
    for (let i = 0; i < inWeek.length; i++)
      for (let j = i + 1; j < inWeek.length; j++) {
        const a = inWeek[i];
        const b = inWeek[j];
        if (a.start < b.end && b.start < a.end) conflicts.push([a, b]);
      }

    const busiest = perDay.reduce((bi, v, i) => (v > perDay[bi] ? i : bi), 0);
    return { total, prevTotal, meeting, focus, days, perDay, meetingPerDay, perCal, freeLeft, noBigSlotDays, conflicts, busiest };
  }, [all, calendars, settings.workStart, settings.workEnd, weekStart.getTime()]);

  const pendingTasks = tasks.filter((t) => !t.done && !t.scheduledEventId);
  const pendingMin = pendingTasks.reduce((a, t) => a + t.duration, 0);
  const maxDay = Math.max(...data.perDay, 60);
  const delta = data.prevTotal ? Math.round(((data.total - data.prevTotal) / data.prevTotal) * 100) : null;

  const tips: { icon: React.ReactNode; text: string; action?: { label: string; run: () => void } }[] = [];
  if (data.total && data.meeting / data.total > 0.5) {
    tips.push({
      icon: <Lightbulb size={14} />,
      text: `Il ${Math.round((data.meeting / data.total) * 100)}% del tuo tempo pianificato è in riunione. Valuta di accorciarne qualcuna a 25 o 50 minuti.`,
    });
  }
  if (data.noBigSlotDays.length) {
    tips.push({
      icon: <Target size={14} />,
      text: `${data.noBigSlotDays.map((d) => fmtWeekdayLong(d)).join(', ')}: nessun blocco libero da 90 minuti per il lavoro concentrato.`,
    });
  } else if (data.focus < 4 * 60) {
    tips.push({
      icon: <Target size={14} />,
      text: `Solo ${fmtDuration(data.focus)} di focus questa settimana. Proteggi del tempo prima che si riempia.`,
      action: { label: 'Proteggi focus', run: protectFocusTime },
    });
  }
  if (data.conflicts.length) {
    tips.push({
      icon: <TriangleAlert size={14} />,
      text: `${data.conflicts.length} ${data.conflicts.length === 1 ? 'sovrapposizione' : 'sovrapposizioni'}: ${data.conflicts
        .slice(0, 2)
        .map(([a, b]) => `“${a.event.title}” e “${b.event.title}”`)
        .join('; ')}.`,
    });
  }
  if (pendingTasks.length) {
    tips.push({
      icon: <WandSparkles size={14} />,
      text: `${pendingTasks.length} attività da pianificare (${fmtDuration(pendingMin)}). Posso inserirle io negli slot liberi.`,
      action: { label: 'Pianifica', run: autoScheduleTasks },
    });
  }

  return (
    <aside className="panel insights">
      <div className="panel-head">
        <div>
          <div className="ins-title">Analisi del tempo</div>
          <div className="muted small">
            Settimana {isoWeek(weekStart)} · {fmtDayMonth(weekStart)} – {fmtDayMonth(addDays(weekEnd, -1))}
          </div>
        </div>
        <button className="icon-btn" onClick={toggleInsights} aria-label="Chiudi">
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        <div className="hero">
          <div className="hero-num">{fmtDuration(data.total)}</div>
          <div className="hero-label">
            pianificate
            {delta !== null && (
              <span className={cls('delta', { up: delta > 0, down: delta < 0 })}>
                {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(delta)}% vs settimana scorsa
              </span>
            )}
          </div>
        </div>

        <div className="tiles">
          <div className="tile">
            <span className="tile-label">In riunione</span>
            <b>{fmtDuration(data.meeting)}</b>
          </div>
          <div className="tile">
            <span className="tile-label">Focus</span>
            <b>{fmtDuration(data.focus)}</b>
          </div>
          <div className="tile">
            <span className="tile-label">Libero (lavorativo)</span>
            <b>{fmtDuration(data.freeLeft)}</b>
          </div>
        </div>

        <h4 className="ins-h">Carico giornaliero</h4>
        <div className="daychart" role="img" aria-label="Ore pianificate per giorno">
          {data.days.map((d, i) => {
            const v = data.perDay[i];
            const m = data.meetingPerDay[i];
            return (
              <div
                key={i}
                className={cls('dc-col', { today: isSameDay(d, now), busiest: i === data.busiest && v > 0 })}
                data-tip={`${fmtWeekdayLong(d)}: ${fmtDuration(v)}${m ? ` (${fmtDuration(m)} riunioni)` : ''}`}
              >
                <span className="dc-val">{i === data.busiest && v > 0 ? `${Math.round((v / 60) * 10) / 10}h` : ''}</span>
                <div className="dc-track">
                  <div className="dc-bar" style={{ height: `${(v / maxDay) * 100}%` }}>
                    {m > 0 && <div className="dc-meet" style={{ height: `${(m / v) * 100}%` }} />}
                  </div>
                </div>
                <span className="dc-label">{fmtWeekdayShort(d).slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <i className="lg-total" /> Totale
          </span>
          <span>
            <i className="lg-meet" /> Riunioni
          </span>
        </div>

        <h4 className="ins-h">Per calendario</h4>
        <div className="calbars">
          {data.perCal.length === 0 && <p className="side-hint">Nessun evento questa settimana.</p>}
          {data.perCal.map(({ cal, min }) => (
            <div key={cal.id} className="cb-row" data-tip={`${cal.name}: ${fmtDuration(min)}`}>
              <div className="cb-top">
                <span className="cb-name">
                  <i style={{ background: colorHex(cal.color) }} />
                  {cal.name}
                </span>
                <span className="cb-val">
                  {fmtDuration(min)} <em>{Math.round((min / Math.max(data.total, 1)) * 100)}%</em>
                </span>
              </div>
              <div className="cb-track">
                <span style={{ width: `${(min / Math.max(data.total, 1)) * 100}%`, background: colorHex(cal.color) }} />
              </div>
            </div>
          ))}
        </div>

        {tips.length > 0 && (
          <>
            <h4 className="ins-h">Suggerimenti</h4>
            <div className="tips">
              {tips.map((t, i) => (
                <div key={i} className="tip">
                  <span className="tip-icon">{t.icon}</span>
                  <div>
                    <p>{t.text}</p>
                    {t.action && (
                      <button className="btn sm accent-soft" onClick={t.action.run}>
                        {t.action.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="ins-actions">
          <button className="btn" onClick={protectFocusTime}>
            <Target size={14} /> Proteggi tempo focus
          </button>
          <button className="btn" onClick={autoScheduleTasks}>
            <WandSparkles size={14} /> Pianifica attività
          </button>
        </div>
        <p className="side-hint">Calcolato su eventi a orario nella settimana {isoWeek(startOfDay(weekStart))}.</p>
      </div>
    </aside>
  );
}
