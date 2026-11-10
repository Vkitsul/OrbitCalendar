import { useState } from 'react';
import { CalendarClock, ChevronRight, Flag, GripVertical, Trash2, WandSparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { dnd } from '../../lib/dnd';
import { cls } from '../../lib/cls';
import { colorHex } from '../../lib/colors';
import { fmtDuration, fmtMediumDate, fmtTime } from '../../lib/date';
import { autoScheduleTasks } from '../../lib/actions';
import type { Task } from '../../types';

const DURATIONS = [15, 30, 45, 60, 90, 120];

/** "Scrivere report 45m !" -> title, 45 min, high priority */
function parseTaskInput(raw: string) {
  let s = raw.trim();
  let duration = 30;
  let priority: 0 | 1 | 2 = 0;
  const bang = s.match(/\s*(!{1,2})\s*$/);
  if (bang) {
    priority = bang[1].length as 1 | 2;
    s = s.slice(0, bang.index).trim();
  }
  const dur = s.match(/\s+(\d+(?:[.,]\d+)?)\s*(m|min|h|ore?)$/i);
  if (dur) {
    const n = parseFloat(dur[1].replace(',', '.'));
    duration = /^h|^or/i.test(dur[2]) ? Math.round(n * 60) : Math.round(n);
    s = s.slice(0, dur.index).trim();
  }
  return { title: s, duration: Math.max(5, duration), priority };
}

export function TaskInbox() {
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const calendars = useStore((s) => s.calendars);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const select = useStore((s) => s.select);
  const setCursor = useStore((s) => s.setCursor);
  const setView = useStore((s) => s.setView);
  const view = useStore((s) => s.view);
  const [text, setText] = useState('');
  const [showScheduled, setShowScheduled] = useState(false);

  const userCals = calendars.filter((c) => !c.system);
  const pending = tasks.filter((t) => !t.scheduledEventId && !t.done);
  const scheduled = tasks.filter((t) => t.scheduledEventId);
  const totalMin = pending.reduce((a, t) => a + t.duration, 0);

  const submit = () => {
    const p = parseTaskInput(text);
    if (!p.title) return;
    addTask({ ...p, calendarId: userCals[0]?.id ?? 'work' });
    setText('');
  };

  const cycleDuration = (t: Task) => {
    const i = DURATIONS.indexOf(t.duration);
    updateTask(t.id, { duration: DURATIONS[(i + 1) % DURATIONS.length] });
  };

  const cycleCalendar = (t: Task) => {
    const i = userCals.findIndex((c) => c.id === t.calendarId);
    updateTask(t.id, { calendarId: userCals[(i + 1) % userCals.length].id });
  };

  return (
    <section className="side-section tasks">
      <div className="side-head">
        <span>
          Da pianificare <em className="count">{pending.length}</em>
        </span>
        {pending.length > 0 && (
          <button className="btn ghost xs accent" onClick={autoScheduleTasks} data-tip="Inserisci le attività negli slot liberi">
            <WandSparkles size={13} /> Auto
          </button>
        )}
      </div>
      <input
        className="input sm task-input"
        placeholder="Nuova attività… es. Report 45m !"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
      />
      {pending.length > 0 ? (
        <>
          <ul className="task-list">
            {pending.map((t) => {
              const cal = userCals.find((c) => c.id === t.calendarId);
              return (
                <li
                  key={t.id}
                  className="task-row"
                  draggable
                  style={{ ['--c' as string]: colorHex(cal?.color) }}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', t.title);
                    dnd.set({ kind: 'task', id: t.id, duration: t.duration, title: t.title });
                    if (view === 'year' || view === 'agenda') setView('week');
                  }}
                  onDragEnd={() => dnd.clear()}
                >
                  <GripVertical size={13} className="grip" />
                  <button
                    className="task-check"
                    onClick={() => updateTask(t.id, { done: true })}
                    aria-label="Completa"
                  />
                  <span className="task-title" title={t.title}>
                    {t.title}
                  </span>
                  {(t.priority ?? 0) > 0 && (
                    <Flag size={12} className={cls('prio', { high: t.priority === 2 })} />
                  )}
                  <button className="task-cal" onClick={() => cycleCalendar(t)} data-tip={cal?.name} />
                  <button className="task-dur" onClick={() => cycleDuration(t)} data-tip="Cambia durata">
                    {t.duration < 60 ? `${t.duration}m` : `${t.duration / 60}h`}
                  </button>
                  <button className="icon-btn xs task-del" onClick={() => removeTask(t.id)} aria-label="Elimina">
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="side-hint">
            Trascina sul calendario · totale {fmtDuration(totalMin)}
          </p>
        </>
      ) : (
        <p className="side-hint">Inbox vuota. Aggiungi attività e trascinale nel calendario.</p>
      )}

      {scheduled.length > 0 && (
        <div className="scheduled">
          <button className="scheduled-toggle" onClick={() => setShowScheduled((v) => !v)}>
            <ChevronRight size={13} className={cls({ rot: showScheduled })} />
            Pianificate ({scheduled.length})
          </button>
          {showScheduled && (
            <ul className="task-list">
              {scheduled.map((t) => {
                const ev = events.find((e) => e.id === t.scheduledEventId);
                if (!ev) return null;
                const start = new Date(ev.start);
                return (
                  <li
                    key={t.id}
                    className={cls('task-row scheduled-row', { done: t.done })}
                    onClick={() => {
                      setCursor(start);
                      select(ev.id);
                    }}
                  >
                    <CalendarClock size={13} className="muted" />
                    <span className="task-title">{t.title}</span>
                    <span className="task-when">
                      {fmtMediumDate(start)} {fmtTime(start)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
