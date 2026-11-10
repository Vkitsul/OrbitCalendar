import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  CalendarDays,
  Check,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Repeat,
  Sparkles,
  TriangleAlert,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import type { CalEvent, ColorKey, Freq, Occurrence } from '../types';
import {
  addDays,
  dateKey,
  diffDays,
  fmtDuration,
  fmtFullDate,
  fmtTime,
  fromDateKey,
  minutesOfDay,
  MS_MIN,
  setMinutesOfDay,
  startOfDay,
} from '../lib/date';
import { FREQ_LABEL, getOccurrences, HOLIDAY_CAL_ID, holidayOccurrences, occurrenceFromKey } from '../lib/recurrence';
import { COLOR_KEYS, colorHex, COLORS } from '../lib/colors';
import { cls } from '../lib/cls';
import { isAllDayLike } from '../lib/layout';
import { TimeSelect } from './TimeSelect';
import { DatePicker } from './DatePicker';

export function EventPanel() {
  const key = useStore((s) => s.selectedKey);
  const events = useStore((s) => s.events);
  const calendars = useStore((s) => s.calendars);

  const occ: Occurrence | null = useMemo(() => {
    if (!key) return null;
    if (key.startsWith('hol-')) {
      const d = fromDateKey(key.slice(4));
      const cal = calendars.find((c) => c.id === HOLIDAY_CAL_ID);
      return cal ? (holidayOccurrences(d, addDays(d, 1), cal)[0] ?? null) : null;
    }
    return occurrenceFromKey(key, events);
  }, [key, events, calendars]);

  if (!occ) return null;
  return (
    <aside className="panel event-panel">
      {occ.readOnly ? <ReadOnlyBody occ={occ} /> : <EditBody occ={occ} />}
    </aside>
  );
}

function ReadOnlyBody({ occ }: { occ: Occurrence }) {
  const closePanel = useStore((s) => s.closePanel);
  return (
    <>
      <div className="panel-head">
        <span className="panel-cal">
          <i style={{ background: colorHex('red') }} /> Festività italiane
        </span>
        <button className="icon-btn" onClick={closePanel} aria-label="Chiudi">
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        <h2 className="ro-title">{occ.event.title}</h2>
        <div className="field-row">
          <CalendarDays size={15} />
          <span>{fmtFullDate(occ.start)}</span>
        </div>
        <p className="side-hint">Festività nazionale. Puoi nasconderle dalle impostazioni.</p>
      </div>
    </>
  );
}

function EditBody({ occ }: { occ: Occurrence }) {
  const ev = occ.event;
  const calendars = useStore((s) => s.calendars);
  const events = useStore((s) => s.events);
  const draftId = useStore((s) => s.draftId);
  const settings = useStore((s) => s.settings);
  const updateEvent = useStore((s) => s.updateEvent);
  const detachOccurrence = useStore((s) => s.detachOccurrence);
  const deleteOccurrence = useStore((s) => s.deleteOccurrence);
  const duplicateOccurrence = useStore((s) => s.duplicateOccurrence);
  const pushHistory = useStore((s) => s.pushHistory);
  const toggleEventDone = useStore((s) => s.toggleEventDone);
  const closePanel = useStore((s) => s.closePanel);

  const [scope, setScope] = useState<'series' | 'one'>('series');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const baseId = ev.id;

  useEffect(() => {
    setScope('series');
    setConfirmDelete(false);
  }, [baseId]);

  // focus title for freshly created events
  useLayoutEffect(() => {
    if (draftId === ev.id) titleRef.current?.focus();
  }, [draftId, ev.id]);

  // auto-grow title
  useEffect(() => {
    const t = titleRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight}px`;
  }, [ev.title]);

  const userCals = calendars.filter((c) => !c.system);
  const cal = calendars.find((c) => c.id === ev.calendarId);
  const color = colorHex(ev.color ?? cal?.color);

  /** apply a patch honoring the "this occurrence / whole series" scope */
  const apply = (patch: Partial<CalEvent>, record = true) => {
    if (occ.recurring && scope === 'one') {
      pushHistory();
      const id = detachOccurrence(occ.key);
      if (id) updateEvent(id, patch, false);
      return;
    }
    updateEvent(ev.id, patch, record);
  };

  const applyTiming = (start: Date, end: Date) => {
    if (occ.recurring && scope === 'series') {
      const delta = start.getTime() - occ.start.getTime();
      const bs = new Date(new Date(ev.start).getTime() + delta);
      updateEvent(ev.id, { start: bs.toISOString(), end: new Date(bs.getTime() + (end.getTime() - start.getTime())).toISOString() });
      return;
    }
    apply({ start: start.toISOString(), end: end.toISOString() });
  };

  const durMin = (occ.end.getTime() - occ.start.getTime()) / MS_MIN;
  const startMin = minutesOfDay(occ.start);
  const endRel = startMin + durMin;
  const multiDay = !ev.allDay && diffDays(occ.end, occ.start) >= 1 && minutesOfDay(occ.end) !== 0;
  const lastDay = ev.allDay ? addDays(occ.end, -1) : occ.end;

  // ---- conflicts with other timed events
  const conflicts = useMemo(() => {
    if (isAllDayLike(occ)) return [];
    const list = getOccurrences(events, calendars, startOfDay(occ.start), addDays(startOfDay(occ.end), 1));
    return list.filter(
      (o) => o.key !== occ.key && !isAllDayLike(o) && o.start < occ.end && o.end > occ.start && o.event.id !== ev.id,
    );
  }, [events, calendars, occ, ev.id]);

  const setAllDay = (on: boolean) => {
    if (on) {
      const s = startOfDay(occ.start);
      const e = Math.max(addDays(s, 1).getTime(), startOfDay(addDays(occ.end, minutesOfDay(occ.end) ? 1 : 0)).getTime());
      apply({ allDay: true, start: s.toISOString(), end: new Date(e).toISOString() });
    } else {
      const s = setMinutesOfDay(occ.start, settings.workStart * 60);
      apply({
        allDay: false,
        start: s.toISOString(),
        end: new Date(s.getTime() + settings.defaultDuration * MS_MIN).toISOString(),
      });
    }
  };

  const setRecurrence = (v: string) => {
    if (!v) {
      // stop repeating: keep the occurrence currently open
      updateEvent(ev.id, { recurrence: null, start: occ.start.toISOString(), end: occ.end.toISOString() });
      return;
    }
    updateEvent(ev.id, {
      recurrence: { freq: v as Freq, exdates: ev.recurrence?.exdates ?? [], until: ev.recurrence?.until ?? null },
    });
  };

  const attendees = ev.attendees ?? [];
  const [attendeeText, setAttendeeText] = useState('');
  const addAttendees = () => {
    const names = attendeeText
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (names.length) apply({ attendees: [...attendees, ...names] });
    setAttendeeText('');
  };

  return (
    <>
      <div className="panel-head">
        <label className="panel-cal" style={{ ['--c' as string]: color }}>
          <i />
          <select value={ev.calendarId} onChange={(e) => apply({ calendarId: e.target.value })}>
            {userCals.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="panel-tools">
          <button className="icon-btn" onClick={() => duplicateOccurrence(occ.key)} data-tip="Duplica (Ctrl+D)">
            <Copy size={15} />
          </button>
          <button
            className={cls('icon-btn', { active: confirmDelete })}
            onClick={() => (occ.recurring ? setConfirmDelete((v) => !v) : deleteOccurrence(occ.key))}
            data-tip="Elimina (Canc)"
          >
            <Trash2 size={15} />
          </button>
          <button className="icon-btn" onClick={closePanel} data-tip="Chiudi (Esc)">
            <X size={16} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="confirm-bar">
          <span>Evento ricorrente:</span>
          <button className="btn sm" onClick={() => deleteOccurrence(occ.key, 'one')}>
            Elimina solo questo
          </button>
          <button className="btn sm danger" onClick={() => deleteOccurrence(occ.key, 'all')}>
            Tutta la serie
          </button>
        </div>
      )}

      <div className="panel-body">
        <div className="title-row" style={{ ['--c' as string]: color }}>
          {ev.kind === 'task' && (
            <button className={cls('task-check big', { checked: ev.done })} onClick={() => toggleEventDone(ev.id)}>
              {ev.done && <Check size={12} strokeWidth={3} />}
            </button>
          )}
          <textarea
            ref={titleRef}
            className={cls('title-input', { done: ev.done })}
            placeholder="Aggiungi un titolo"
            rows={1}
            value={ev.title}
            onFocus={() => pushHistory()}
            onChange={(e) => apply({ title: e.target.value }, false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        </div>
        {ev.kind === 'focus' && (
          <div className="kind-badge">
            <Sparkles size={12} /> Blocco focus
          </div>
        )}

        {occ.recurring && (
          <div className="scope">
            <span>Modifica</span>
            <div className="seg sm">
              <button className={cls('seg-btn', { active: scope === 'one' })} onClick={() => setScope('one')}>
                Solo questo
              </button>
              <button className={cls('seg-btn', { active: scope === 'series' })} onClick={() => setScope('series')}>
                Tutta la serie
              </button>
            </div>
          </div>
        )}

        {/* ---- when */}
        <div className="field">
          <Clock size={15} className="field-icon" />
          <div className="field-content">
            <div className="when-row">
              <DatePicker
                value={occ.start}
                onChange={(d) => {
                  const delta = diffDays(d, occ.start);
                  if (delta) applyTiming(addDays(occ.start, delta), addDays(occ.end, delta));
                }}
              />
              {!ev.allDay && (
                <>
                  <TimeSelect
                    value={startMin}
                    onChange={(m) => {
                      const s = setMinutesOfDay(occ.start, m);
                      applyTiming(s, new Date(s.getTime() + durMin * MS_MIN));
                    }}
                  />
                  <span className="muted">–</span>
                  <TimeSelect
                    value={endRel}
                    relativeTo={startMin}
                    onChange={(m) => applyTiming(occ.start, new Date(occ.start.getTime() + (m - startMin) * MS_MIN))}
                  />
                </>
              )}
            </div>
            {(ev.allDay || multiDay) && (
              <div className="when-row">
                <span className="muted small">fino a</span>
                <DatePicker
                  value={lastDay}
                  min={occ.start}
                  onChange={(d) => {
                    if (ev.allDay) applyTiming(occ.start, addDays(d, 1));
                    else applyTiming(occ.start, setMinutesOfDay(d, minutesOfDay(occ.end)));
                  }}
                />
              </div>
            )}
            <div className="when-meta">
              <label className="toggle">
                <input type="checkbox" checked={ev.allDay} onChange={(e) => setAllDay(e.target.checked)} />
                <span className="toggle-track" />
                Tutto il giorno
              </label>
              <span className="muted small">
                {ev.allDay
                  ? `${diffDays(occ.end, occ.start)} ${diffDays(occ.end, occ.start) === 1 ? 'giorno' : 'giorni'}`
                  : fmtDuration(durMin)}
              </span>
            </div>
          </div>
        </div>

        {/* ---- repeat */}
        <div className="field">
          <Repeat size={15} className="field-icon" />
          <div className="field-content">
            <select className="input" value={ev.recurrence?.freq ?? ''} onChange={(e) => setRecurrence(e.target.value)}>
              <option value="">Non si ripete</option>
              {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABEL[f]}
                </option>
              ))}
            </select>
            {ev.recurrence && (
              <div className="when-row">
                <span className="muted small">termina</span>
                <DatePicker
                  value={ev.recurrence.until ? fromDateKey(ev.recurrence.until) : null}
                  placeholder="Mai"
                  min={new Date(ev.start)}
                  onChange={(d) => updateEvent(ev.id, { recurrence: { ...ev.recurrence!, until: dateKey(d) } })}
                />
                {ev.recurrence.until && (
                  <button
                    className="icon-btn xs"
                    onClick={() => updateEvent(ev.id, { recurrence: { ...ev.recurrence!, until: null } })}
                    aria-label="Mai"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- color */}
        <div className="field">
          <span className="field-icon dot" style={{ background: color }} />
          <div className="field-content">
            <div className="swatches">
              <button
                className={cls('swatch auto', { active: !ev.color })}
                style={{ ['--c' as string]: colorHex(cal?.color) }}
                onClick={() => apply({ color: null })}
                data-tip="Colore del calendario"
              />
              {COLOR_KEYS.map((k: ColorKey) => (
                <button
                  key={k}
                  className={cls('swatch', { active: ev.color === k })}
                  style={{ ['--c' as string]: COLORS[k].hex }}
                  onClick={() => apply({ color: k })}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ---- location */}
        <div className="field">
          <MapPin size={15} className="field-icon" />
          <div className="field-content row">
            <input
              className="input ghost-input"
              placeholder="Aggiungi luogo"
              value={ev.location ?? ''}
              onFocus={() => pushHistory()}
              onChange={(e) => apply({ location: e.target.value }, false)}
            />
            {ev.location && (
              <a
                className="icon-btn xs"
                href={`https://www.google.com/maps/search/${encodeURIComponent(ev.location)}`}
                target="_blank"
                rel="noreferrer"
                data-tip="Apri in Maps"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>

        {/* ---- video call */}
        <div className="field">
          <Video size={15} className="field-icon" />
          <div className="field-content">
            {ev.meetingUrl ? (
              <div className="meeting">
                <a className="btn btn-join" href={ev.meetingUrl} target="_blank" rel="noreferrer">
                  <Video size={14} /> Partecipa
                </a>
                <input
                  className="input ghost-input small"
                  value={ev.meetingUrl}
                  onFocus={() => pushHistory()}
                  onChange={(e) => apply({ meetingUrl: e.target.value }, false)}
                />
              </div>
            ) : (
              <div className="row">
                <input
                  className="input ghost-input"
                  placeholder="Link videochiamata"
                  value=""
                  onChange={(e) => apply({ meetingUrl: e.target.value })}
                />
                <button
                  className="btn ghost xs"
                  onClick={() =>
                    apply({ meetingUrl: `https://meet.jit.si/orbit-${Math.random().toString(36).slice(2, 10)}` })
                  }
                  data-tip="Crea una stanza Jitsi gratuita"
                >
                  Genera
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---- attendees */}
        <div className="field">
          <Users size={15} className="field-icon" />
          <div className="field-content">
            {attendees.length > 0 && (
              <div className="chips">
                {attendees.map((a, i) => (
                  <span key={i} className="person">
                    <i>{a.charAt(0).toUpperCase()}</i>
                    {a}
                    <button onClick={() => apply({ attendees: attendees.filter((_, j) => j !== i) })} aria-label="Rimuovi">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className="input ghost-input"
              placeholder="Aggiungi partecipanti"
              value={attendeeText}
              onChange={(e) => setAttendeeText(e.target.value)}
              onBlur={addAttendees}
              onKeyDown={(e) => e.key === 'Enter' && addAttendees()}
            />
          </div>
        </div>

        {/* ---- notes */}
        <div className="field">
          <AlignLeft size={15} className="field-icon" />
          <div className="field-content">
            <textarea
              className="input ghost-input notes"
              placeholder="Aggiungi note, agenda, link…"
              value={ev.description ?? ''}
              onFocus={() => pushHistory()}
              onChange={(e) => apply({ description: e.target.value }, false)}
              rows={4}
            />
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="conflicts">
            <div className="conflicts-head">
              <TriangleAlert size={14} /> Si sovrappone a {conflicts.length} {conflicts.length === 1 ? 'evento' : 'eventi'}
            </div>
            {conflicts.slice(0, 4).map((c) => (
              <div key={c.key} className="conflict-row">
                <i style={{ background: colorHex(c.event.color ?? calendars.find((x) => x.id === c.event.calendarId)?.color) }} />
                <span>{c.event.title || 'Senza titolo'}</span>
                <span className="muted">
                  {fmtTime(c.start)}–{fmtTime(c.end)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel-foot">
        <span>
          <kbd>Esc</kbd> chiudi · <kbd>Ctrl</kbd>
          <kbd>Z</kbd> annulla
        </span>
      </div>
    </>
  );
}
