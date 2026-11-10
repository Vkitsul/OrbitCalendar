import { useState } from 'react';
import { Check, Crosshair, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { COLOR_KEYS, colorHex, COLORS } from '../../lib/colors';
import { cls } from '../../lib/cls';
import type { ColorKey } from '../../types';

export function CalendarList() {
  const calendars = useStore((s) => s.calendars);
  const toggle = useStore((s) => s.toggleCalendar);
  const solo = useStore((s) => s.soloCalendar);
  const update = useStore((s) => s.updateCalendar);
  const remove = useStore((s) => s.removeCalendar);
  const add = useStore((s) => s.addCalendar);
  const showHolidays = useStore((s) => s.settings.showHolidays);

  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ColorKey>('teal');

  const submitNew = () => {
    if (newName.trim()) add(newName.trim(), newColor);
    setNewName('');
    setAdding(false);
  };

  return (
    <section className="side-section">
      <div className="side-head">
        <span>Calendari</span>
        <button className="icon-btn sm" onClick={() => setAdding((a) => !a)} data-tip="Nuovo calendario">
          <Plus size={14} />
        </button>
      </div>
      <ul className="cal-list">
        {calendars
          .filter((c) => !c.system || showHolidays)
          .map((c) => (
            <li key={c.id} className={cls('cal-row', { hidden: !c.visible, open: editing === c.id })}>
              <div className="cal-main" onClick={() => toggle(c.id)}>
                <span className="cal-check" style={{ ['--c' as string]: colorHex(c.color) }}>
                  {c.visible && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="cal-name">{c.name}</span>
                <span className="cal-actions">
                  <button
                    className="icon-btn xs"
                    data-tip="Mostra solo questo"
                    onClick={(e) => {
                      e.stopPropagation();
                      solo(c.id);
                    }}
                  >
                    <Crosshair size={12} />
                  </button>
                  {!c.system && (
                    <button
                      className="icon-btn xs"
                      data-tip="Modifica"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(editing === c.id ? null : c.id);
                      }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  )}
                </span>
              </div>
              {editing === c.id && (
                <div className="cal-edit">
                  <input
                    className="input sm"
                    defaultValue={c.name}
                    onBlur={(e) => e.target.value.trim() && update(c.id, { name: e.target.value.trim() })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                  <div className="swatches">
                    {COLOR_KEYS.map((k) => (
                      <button
                        key={k}
                        className={cls('swatch', { active: c.color === k })}
                        style={{ ['--c' as string]: COLORS[k].hex }}
                        onClick={() => update(c.id, { color: k })}
                        aria-label={COLORS[k].label}
                      />
                    ))}
                  </div>
                  <button className="btn ghost danger sm" onClick={() => remove(c.id)}>
                    <Trash2 size={13} /> Elimina calendario
                  </button>
                </div>
              )}
            </li>
          ))}
      </ul>
      {adding && (
        <div className="cal-edit standalone">
          <input
            className="input sm"
            autoFocus
            placeholder="Nome del calendario"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') setAdding(false);
            }}
          />
          <div className="swatches">
            {COLOR_KEYS.map((k) => (
              <button
                key={k}
                className={cls('swatch', { active: newColor === k })}
                style={{ ['--c' as string]: COLORS[k].hex }}
                onClick={() => setNewColor(k)}
                aria-label={COLORS[k].label}
              />
            ))}
          </div>
          <button className="btn primary sm" onClick={submitNew}>
            Crea calendario
          </button>
        </div>
      )}
    </section>
  );
}
