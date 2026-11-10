import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtDuration, minutesToLabel, parseTimeInput } from '../lib/date';
import { cls } from '../lib/cls';

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  /** when set, options start after this value and show the resulting duration */
  relativeTo?: number;
}

/** Time field with typing support ("930", "14:15") and a 15-minute dropdown */
export function TimeSelect({ value, onChange, relativeTo }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(minutesToLabel(value));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(minutesToLabel(value)), [value]);

  const options: number[] = [];
  if (relativeTo !== undefined) for (let m = relativeTo + 15; m <= relativeTo + 24 * 60; m += 15) options.push(m);
  else for (let m = 0; m < 24 * 60; m += 15) options.push(m);

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('.active') ?? listRef.current.querySelector<HTMLElement>('.near');
    if (el) listRef.current.scrollTop = el.offsetTop - 60;
  }, [open]);

  const commit = () => {
    const parsed = parseTimeInput(text);
    if (parsed === null) {
      setText(minutesToLabel(value));
      return;
    }
    let m = parsed;
    if (relativeTo !== undefined) {
      m = parsed + Math.floor(relativeTo / (24 * 60)) * 24 * 60;
      if (m <= relativeTo) m += 24 * 60;
    }
    if (m !== value) onChange(m);
  };

  const nearest = options.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a), options[0]);

  return (
    <div className="timesel">
      <input
        className="input time-input"
        value={text}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => {
          setOpen(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(minutesToLabel(value));
            setOpen(false);
            e.stopPropagation();
          }
        }}
      />
      {open && (
        <div className="timesel-list" ref={listRef}>
          {options.map((m) => (
            <button
              key={m}
              className={cls('timesel-opt', { active: m === value, near: m === nearest })}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(m);
                setOpen(false);
                (document.activeElement as HTMLElement)?.blur();
              }}
            >
              <span>{minutesToLabel(m)}</span>
              {relativeTo !== undefined && <span className="muted">{fmtDuration(m - relativeTo)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
