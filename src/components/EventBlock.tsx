import { Check, Repeat, Video } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Occurrence } from '../types';
import { cls } from '../lib/cls';
import { dnd } from '../lib/dnd';
import { colorHex } from '../lib/colors';
import { fmtTime } from '../lib/date';
import { useStore } from '../store/useStore';

export function useEventColor(occ: Occurrence) {
  const calendars = useStore((s) => s.calendars);
  const cal = calendars.find((c) => c.id === occ.event.calendarId);
  return colorHex(occ.event.color ?? cal?.color);
}

interface TimedProps {
  occ: Occurrence;
  style: CSSProperties;
  heightPx: number;
  selected: boolean;
  past: boolean;
  dragging?: boolean;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}

export function TimedEventBlock({ occ, style, heightPx, selected, past, dragging, continuesBefore, continuesAfter }: TimedProps) {
  const color = useEventColor(occ);
  const toggleDone = useStore((s) => s.toggleEventDone);
  const ev = occ.event;
  const compact = heightPx < 38;
  const tiny = heightPx < 22;
  const isTask = ev.kind === 'task';

  return (
    <div
      className={cls('ev ev-timed', {
        selected,
        past,
        dragging,
        compact,
        tiny,
        'ev-focus': ev.kind === 'focus',
        'ev-task': isTask,
        done: ev.done,
        'cont-before': continuesBefore,
        'cont-after': continuesAfter,
      })}
      data-key={occ.key}
      style={{ ...style, ['--c' as string]: color }}
    >
      <div className="ev-inner">
        {isTask && (
          <button
            className="ev-check"
            data-nodrag
            aria-label={ev.done ? 'Segna come da fare' : 'Segna come completata'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleDone(ev.id);
            }}
          >
            {ev.done && <Check size={9} strokeWidth={3.5} />}
          </button>
        )}
        <div className="ev-text">
          <div className="ev-title">
            {ev.title || <span className="muted-title">Senza titolo</span>}
            {compact && !tiny && <span className="ev-inline-time">{fmtTime(occ.start)}</span>}
          </div>
          {!compact && (
            <div className="ev-meta">
              {fmtTime(occ.start)} – {fmtTime(occ.end)}
              {ev.location ? ` · ${ev.location}` : ''}
            </div>
          )}
        </div>
        {!tiny && (ev.meetingUrl || occ.recurring) && (
          <div className="ev-icons">
            {ev.meetingUrl && <Video size={11} />}
            {occ.recurring && <Repeat size={10} />}
          </div>
        )}
      </div>
      {!occ.readOnly && <div className="ev-resize" />}
    </div>
  );
}

interface ChipProps {
  occ: Occurrence;
  selected: boolean;
  past: boolean;
  variant: 'allday' | 'timed';
  onClick: (e: React.MouseEvent) => void;
  dayForDrag: Date;
  style?: CSSProperties;
  contBefore?: boolean;
  contAfter?: boolean;
}

/** Compact event used in month view and in the all-day lane */
export function EventChip({ occ, selected, past, variant, onClick, dayForDrag, style, contBefore, contAfter }: ChipProps) {
  const color = useEventColor(occ);
  const ev = occ.event;
  return (
    <div
      className={cls('chip', `chip-${variant}`, {
        selected,
        past,
        'ev-focus': ev.kind === 'focus',
        done: ev.done,
        'cont-before': contBefore,
        'cont-after': contAfter,
        readonly: occ.readOnly,
      })}
      style={{ ...style, ['--c' as string]: color }}
      data-key={occ.key}
      draggable={!occ.readOnly}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ev.title);
        dnd.set({ kind: 'occ', key: occ.key, fromDay: dayForDrag.getTime() });
      }}
      onDragEnd={() => dnd.clear()}
      onClick={onClick}
      title={ev.title}
    >
      {variant === 'timed' && <span className="chip-dot" />}
      {variant === 'timed' && <span className="chip-time">{fmtTime(occ.start)}</span>}
      <span className="chip-title">{ev.title || 'Senza titolo'}</span>
      {ev.meetingUrl && variant === 'timed' && <Video size={11} className="chip-icon" />}
    </div>
  );
}
