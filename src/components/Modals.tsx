import { useEffect } from 'react';
import { Bell, Check, Copy, Download, Monitor, Moon, Sun, Upload, WandSparkles, X } from 'lucide-react';
import { useStore, type Toast } from '../store/useStore';
import { COLOR_KEYS, COLORS } from '../lib/colors';
import { cls } from '../lib/cls';
import { fmtTimeInZone, localTimeZone, tzOffsetLabel } from '../lib/date';
import {
  availabilityText,
  copyAvailability,
  exportCalendar,
  fillAvailabilityFromFreeTime,
  importCalendarFile,
} from '../lib/actions';

function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return (
    <div className="overlay center" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Rome',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const resetDemo = useStore((s) => s.resetDemo);
  if (!open) return null;

  const Toggle = ({ k, label, desc }: { k: 'hideWeekends' | 'showWeekNumbers' | 'showHolidays' | 'dimPast' | 'remindersEnabled'; label: string; desc?: string }) => (
    <label className="set-row">
      <div>
        <div className="set-label">{label}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <span className="toggle">
        <input type="checkbox" checked={settings[k]} onChange={(e) => update({ [k]: e.target.checked })} />
        <span className="toggle-track" />
      </span>
    </label>
  );

  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <Modal title="Impostazioni" onClose={() => setOpen(false)} width={600}>
      <div className="set-group">
        <h4>Aspetto</h4>
        <div className="set-row">
          <div className="set-label">Tema</div>
          <div className="seg">
            {(
              [
                ['system', 'Sistema', <Monitor size={14} key="m" />],
                ['light', 'Chiaro', <Sun size={14} key="s" />],
                ['dark', 'Scuro', <Moon size={14} key="d" />],
              ] as const
            ).map(([v, l, icon]) => (
              <button key={v} className={cls('seg-btn', { active: settings.theme === v })} onClick={() => update({ theme: v })}>
                {icon} {l}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="set-label">Colore principale</div>
          <div className="swatches">
            {COLOR_KEYS.map((k) => (
              <button
                key={k}
                className={cls('swatch', { active: settings.accent === k })}
                style={{ ['--c' as string]: COLORS[k].hex }}
                onClick={() => update({ accent: k })}
                aria-label={COLORS[k].label}
              />
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="set-label">Altezza delle ore</div>
          <input
            type="range"
            min={28}
            max={140}
            value={settings.hourHeight}
            onChange={(e) => update({ hourHeight: +e.target.value })}
          />
        </div>
        <Toggle k="dimPast" label="Attenua eventi passati" />
      </div>

      <div className="set-group">
        <h4>Calendario</h4>
        <div className="set-row">
          <div className="set-label">La settimana inizia di</div>
          <div className="seg">
            <button className={cls('seg-btn', { active: settings.weekStartsOn === 1 })} onClick={() => update({ weekStartsOn: 1 })}>
              Lunedì
            </button>
            <button className={cls('seg-btn', { active: settings.weekStartsOn === 0 })} onClick={() => update({ weekStartsOn: 0 })}>
              Domenica
            </button>
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Orario di lavoro</div>
            <div className="set-desc">Usato per slot liberi, focus e pianificazione automatica</div>
          </div>
          <div className="row">
            <select className="input sm" value={settings.workStart} onChange={(e) => update({ workStart: +e.target.value })}>
              {hours.slice(0, 24).map((h) => (
                <option key={h} value={h} disabled={h >= settings.workEnd}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <span className="muted">–</span>
            <select className="input sm" value={settings.workEnd} onChange={(e) => update({ workEnd: +e.target.value })}>
              {hours.slice(1).map((h) => (
                <option key={h} value={h} disabled={h <= settings.workStart}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="set-row">
          <div className="set-label">Durata predefinita eventi</div>
          <select className="input sm" value={settings.defaultDuration} onChange={(e) => update({ defaultDuration: +e.target.value })}>
            {[15, 25, 30, 45, 50, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Secondo fuso orario</div>
            <div className="set-desc">
              Mostrato accanto agli orari · il tuo: {localTimeZone()} ({tzOffsetLabel(localTimeZone())})
            </div>
          </div>
          <select
            className="input sm"
            value={settings.secondaryTz ?? ''}
            onChange={(e) => update({ secondaryTz: e.target.value || null })}
          >
            <option value="">Nessuno</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.split('/')[1].replace('_', ' ')} · {fmtTimeInZone(new Date(), tz)}
              </option>
            ))}
          </select>
        </div>
        <Toggle k="hideWeekends" label="Nascondi i weekend" />
        <Toggle k="showWeekNumbers" label="Mostra numeri delle settimane" />
        <Toggle k="showHolidays" label="Festività italiane" desc="Pasqua, 25 aprile, 2 giugno, Ferragosto…" />
        <Toggle k="remindersEnabled" label="Promemoria" desc="Avviso 5 minuti prima di ogni evento (con link alla call)" />
      </div>

      <div className="set-group">
        <h4>Dati</h4>
        <div className="set-row">
          <div>
            <div className="set-label">Importa / Esporta</div>
            <div className="set-desc">Formato .ics compatibile con Google, Outlook e Apple Calendar</div>
          </div>
          <div className="row">
            <button className="btn sm" onClick={importCalendarFile}>
              <Upload size={13} /> Importa
            </button>
            <button className="btn sm" onClick={exportCalendar}>
              <Download size={13} /> Esporta
            </button>
          </div>
        </div>
        <div className="set-row">
          <div>
            <div className="set-label">Dati demo</div>
            <div className="set-desc">I dati sono salvati nel browser (localStorage)</div>
          </div>
          <button className="btn sm danger" onClick={resetDemo}>
            Ripristina
          </button>
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, [string, string[]][]][] = [
  [
    'Navigazione',
    [
      ['Oggi', ['T']],
      ['Periodo successivo / precedente', ['J', 'K']],
      ['Periodo successivo / precedente', ['→', '←']],
      ['Vista giorno · 3 giorni · settimana', ['D', '3', 'W']],
      ['Vista mese · anno · agenda', ['M', 'Y', 'A']],
      ['Zoom ore', ['Ctrl', 'rotellina']],
    ],
  ],
  [
    'Eventi',
    [
      ['Nuovo evento', ['C']],
      ['Cerca / crea con linguaggio naturale', ['Ctrl', 'K']],
      ['Duplica evento selezionato', ['Ctrl', 'D']],
      ['Elimina evento selezionato', ['Canc']],
      ['Annulla ultima modifica', ['Ctrl', 'Z']],
      ['Chiudi pannello', ['Esc']],
    ],
  ],
  [
    'Strumenti',
    [
      ['Condividi disponibilità', ['S']],
      ['Analisi del tempo', ['I']],
      ['Proteggi tempo focus', ['F']],
      ['Barra laterale', ['[']],
      ['Impostazioni', [',']],
      ['Questa guida', ['?']],
    ],
  ],
];

export function ShortcutsModal() {
  const open = useStore((s) => s.shortcutsOpen);
  const setOpen = useStore((s) => s.setShortcutsOpen);
  if (!open) return null;
  return (
    <Modal title="Scorciatoie da tastiera" onClose={() => setOpen(false)} width={680}>
      <div className="shortcuts">
        {SHORTCUTS.map(([group, list]) => (
          <div key={group} className="sc-group">
            <h4>{group}</h4>
            {list.map(([label, keys], i) => (
              <div key={i} className="sc-row">
                <span>{label}</span>
                <span className="sc-keys">
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="side-hint" style={{ marginTop: 12 }}>
        Nella palette (Ctrl K) puoi scrivere frasi come “Call con Luca venerdì dalle 15 alle 16 #lavoro” o “Palestra ogni
        martedì alle 19”.
      </p>
    </Modal>
  );
}

export function AvailabilityBar() {
  const availability = useStore((s) => s.availability);
  const setAvailability = useStore((s) => s.setAvailability);
  const setSlots = useStore((s) => s.setAvailabilitySlots);
  if (!availability.active) return null;
  const n = availability.slots.length;
  return (
    <div className="availbar">
      <div className="ab-text">
        <b>Condividi disponibilità</b>
        <span>{n ? `${n} slot selezionati` : 'Trascina sul calendario per selezionare gli slot liberi'}</span>
      </div>
      <button className="btn sm" onClick={fillAvailabilityFromFreeTime}>
        <WandSparkles size={13} /> Auto-compila liberi
      </button>
      {n > 0 && (
        <button className="btn sm ghost" onClick={() => setSlots([])}>
          Svuota
        </button>
      )}
      <button
        className="btn sm primary"
        disabled={!n}
        onClick={copyAvailability}
        data-tip={n ? availabilityText(availability.slots) : undefined}
      >
        <Copy size={13} /> Copia testo
      </button>
      <button className="icon-btn" onClick={() => setAvailability(false)} aria-label="Esci">
        <X size={15} />
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.duration ?? (t.tone === 'reminder' ? 30_000 : 5000));
    return () => clearTimeout(id);
  }, [t, dismiss]);
  return (
    <div className={cls('toast', t.tone)}>
      {t.tone === 'success' && <Check size={15} className="toast-icon" />}
      {t.tone === 'reminder' && <Bell size={15} className="toast-icon" />}
      <span className="toast-msg">{t.message}</span>
      {t.secondary && (
        <button
          className="toast-btn"
          onClick={() => {
            t.secondary!.run();
            dismiss(t.id);
          }}
        >
          {t.secondary.label}
        </button>
      )}
      {t.action && (
        <button
          className="toast-btn strong"
          onClick={() => {
            t.action!.run();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      )}
      <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="Chiudi">
        <X size={13} />
      </button>
    </div>
  );
}
