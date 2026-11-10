import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  addDays,
  addMonths,
  fmtMediumDate,
  fmtMonthYear,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../lib/date';
import { cls } from '../lib/cls';

interface Props {
  value: Date | null;
  onChange: (d: Date) => void;
  min?: Date;
  placeholder?: string;
}

/** Compact date button with a popover month grid (locale independent, matches the app style) */
export function DatePicker({ value, onChange, min, placeholder = 'Seleziona' }: Props) {
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()));
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => {
    if (!open) return;
    setMonth(startOfMonth(value ?? new Date()));
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const start = startOfWeek(month, weekStartsOn);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const minDay = min ? startOfDay(min) : null;

  const pick = (d: Date) => {
    onChange(d);
    setOpen(false);
  };

  return (
    <div className="datepick" ref={ref}>
      <button className={cls('input date-btn', { placeholder: !value })} onClick={() => setOpen((o) => !o)}>
        {value
          ? `${fmtMediumDate(value)}${value.getFullYear() !== today.getFullYear() ? ` ${value.getFullYear()}` : ''}`
          : placeholder}
      </button>
      {open && (
        <div className="datepick-pop">
          <div className="dp-head">
            <span>{fmtMonthYear(month)}</span>
            <div className="row">
              <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mese precedente">
                <ChevronLeft size={14} />
              </button>
              <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mese successivo">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="dp-grid">
            {days.slice(0, 7).map((d, i) => (
              <span key={i} className="mini-dow">
                {d.toLocaleDateString('it-IT', { weekday: 'narrow' })}
              </span>
            ))}
            {days.map((d, i) => (
              <button
                key={i}
                disabled={!!minDay && d < minDay}
                className={cls('mini-day', {
                  outside: !isSameMonth(d, month),
                  today: isSameDay(d, today),
                  selected: !!value && isSameDay(d, value),
                })}
                onClick={() => pick(d)}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
          <div className="dp-foot">
            <button className="btn ghost xs" onClick={() => pick(startOfDay(today))}>
              Oggi
            </button>
            <button className="btn ghost xs" onClick={() => pick(addDays(startOfDay(today), 1))}>
              Domani
            </button>
            <button className="btn ghost xs" onClick={() => pick(addDays(startOfWeek(today, 1), 7))}>
              Lun prossimo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
