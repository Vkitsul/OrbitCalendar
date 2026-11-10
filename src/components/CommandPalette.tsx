import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChartColumn,
  Download,
  Eye,
  Keyboard,
  LayoutGrid,
  List,
  Moon,
  PanelLeft,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Square,
  Target,
  Upload,
  WandSparkles,
  Columns3,
  Rows3,
  CalendarClock,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { parseQuickAdd } from '../lib/nlp';
import {
  addDays,
  fmtDuration,
  fmtMediumDate,
  fmtTime,
  isSameDay,
  MS_MIN,
  startOfDay,
} from '../lib/date';
import { expandEvent, FREQ_LABEL } from '../lib/recurrence';
import { colorHex } from '../lib/colors';
import { cls } from '../lib/cls';
import {
  autoScheduleTasks,
  exportCalendar,
  importCalendarFile,
  newEventDraft,
  protectFocusTime,
} from '../lib/actions';
import type { ViewType } from '../types';

interface Item {
  id: string;
  group: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  hint?: string;
  keywords?: string;
  run: () => void;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  if (!open) return null;
  return <PaletteInner />;
}

function PaletteInner() {
  const setPalette = useStore((s) => s.setPalette);
  const events = useStore((s) => s.events);
  const calendars = useStore((s) => s.calendars);
  const settings = useStore((s) => s.settings);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const close = () => setPalette(false);
  const st = useStore.getState;

  const parsed = useMemo(
    () => (q.trim() ? parseQuickAdd(q, { now: new Date(), calendars, defaultDuration: settings.defaultDuration }) : null),
    [q, calendars, settings.defaultDuration],
  );

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    const nq = normalize(q.trim());

    // 1. natural-language creation (on top only when the text contains date/time hints)
    let createItem: Item | null = null;
    const strong =
      !!parsed && (parsed.hasDate || parsed.hasTime || !!parsed.recurrence || !!parsed.calendarId || !!parsed.location || parsed.allDay);
    if (parsed && parsed.title) {
      const cal = calendars.find((c) => c.id === parsed.calendarId) ?? calendars.find((c) => !c.system);
      createItem = {
        id: 'create',
        group: 'Crea',
        icon: <CalendarPlus size={16} />,
        label: (
          <div className="nl-preview">
            <div className="nl-title">
              <i style={{ background: colorHex(cal?.color) }} />
              {parsed.title}
            </div>
            <div className="nl-chips">
              <span className="nl-chip">
                <CalendarDays size={11} />
                {isSameDay(parsed.start, new Date())
                  ? 'Oggi'
                  : isSameDay(parsed.start, addDays(new Date(), 1))
                    ? 'Domani'
                    : fmtMediumDate(parsed.start)}
              </span>
              <span className="nl-chip">
                {parsed.allDay
                  ? 'Tutto il giorno'
                  : `${fmtTime(parsed.start)} – ${fmtTime(parsed.end)} · ${fmtDuration((parsed.end.getTime() - parsed.start.getTime()) / MS_MIN)}`}
              </span>
              {parsed.recurrence && <span className="nl-chip">{FREQ_LABEL[parsed.recurrence]}</span>}
              {parsed.location && <span className="nl-chip">📍 {parsed.location}</span>}
              <span className="nl-chip">{cal?.name}</span>
            </div>
          </div>
        ),
        hint: 'Invio per creare',
        run: () => {
          const s = st();
          const ev = s.createEvent({
            title: parsed.title,
            start: parsed.start.toISOString(),
            end: parsed.end.toISOString(),
            allDay: parsed.allDay,
            calendarId: cal?.id,
            location: parsed.location,
            recurrence: parsed.recurrence ? { freq: parsed.recurrence, exdates: [] } : null,
          });
          s.setCursor(parsed.start);
          if (s.view === 'year' || s.view === 'agenda') s.setView('week');
          s.pushToast({
            message: `Creato “${ev.title}”`,
            tone: 'success',
            action: { label: 'Annulla', run: () => st().undo() },
          });
        },
      };
      if (strong) out.push(createItem);
    } else if (parsed && parsed.hasDate && !parsed.title) {
      out.push({
        id: 'goto',
        group: 'Vai a',
        icon: <ArrowRight size={16} />,
        label: `Vai a ${fmtMediumDate(parsed.start)}`,
        run: () => st().setCursor(parsed.start),
      });
    }

    // 2. commands
    const view = (v: ViewType, label: string, icon: React.ReactNode, key: string): Item => ({
      id: `view-${v}`,
      group: 'Comandi',
      icon,
      label: `Vista ${label}`,
      hint: key,
      keywords: 'vista view',
      run: () => st().setView(v),
    });
    const commands: Item[] = [
      { id: 'new', group: 'Comandi', icon: <CalendarPlus size={16} />, label: 'Nuovo evento', hint: 'C', keywords: 'crea aggiungi', run: newEventDraft },
      { id: 'today', group: 'Comandi', icon: <CalendarClock size={16} />, label: 'Vai a oggi', hint: 'T', keywords: 'oggi today', run: () => st().goToday() },
      view('day', 'giorno', <Square size={16} />, 'D'),
      view('3day', '3 giorni', <Columns3 size={16} />, '3'),
      view('week', 'settimana', <CalendarRange size={16} />, 'W'),
      view('month', 'mese', <LayoutGrid size={16} />, 'M'),
      view('year', 'anno', <Rows3 size={16} />, 'Y'),
      view('agenda', 'agenda', <List size={16} />, 'A'),
      { id: 'focus', group: 'Smart', icon: <Target size={16} />, label: 'Proteggi tempo focus questa settimana', keywords: 'focus concentrazione deep work blocchi', run: protectFocusTime },
      { id: 'auto', group: 'Smart', icon: <WandSparkles size={16} />, label: 'Pianifica automaticamente le attività', keywords: 'auto task attivita todo', run: autoScheduleTasks },
      { id: 'avail', group: 'Smart', icon: <Share2 size={16} />, label: 'Condividi disponibilità', hint: 'S', keywords: 'slot liberi disponibile', run: () => st().setAvailability(true) },
      { id: 'insights', group: 'Smart', icon: <ChartColumn size={16} />, label: 'Analisi del tempo', hint: 'I', keywords: 'statistiche insights report', run: () => st().rightPanel !== 'insights' && st().toggleInsights() },
      { id: 'theme', group: 'Comandi', icon: <Moon size={16} />, label: 'Cambia tema chiaro / scuro', keywords: 'dark light tema notte', run: () => {
        const t = st().settings.theme;
        const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        st().updateSettings({ theme: dark ? 'light' : 'dark' });
      } },
      { id: 'weekend', group: 'Comandi', icon: <Eye size={16} />, label: settings.hideWeekends ? 'Mostra i weekend' : 'Nascondi i weekend', keywords: 'sabato domenica weekend', run: () => st().updateSettings({ hideWeekends: !st().settings.hideWeekends }) },
      { id: 'sidebar', group: 'Comandi', icon: <PanelLeft size={16} />, label: 'Mostra/nascondi barra laterale', hint: '[', run: () => st().toggleSidebar() },
      { id: 'export', group: 'Dati', icon: <Download size={16} />, label: 'Esporta calendario (.ics)', keywords: 'export backup ics google outlook', run: exportCalendar },
      { id: 'import', group: 'Dati', icon: <Upload size={16} />, label: 'Importa file .ics', keywords: 'import google outlook apple', run: importCalendarFile },
      { id: 'settings', group: 'Comandi', icon: <Settings size={16} />, label: 'Impostazioni', hint: ',', keywords: 'preferenze opzioni', run: () => st().setSettingsOpen(true) },
      { id: 'shortcuts', group: 'Comandi', icon: <Keyboard size={16} />, label: 'Scorciatoie da tastiera', hint: '?', run: () => st().setShortcutsOpen(true) },
      { id: 'reset', group: 'Dati', icon: <RotateCcw size={16} />, label: 'Ripristina dati demo', keywords: 'reset demo', run: () => st().resetDemo() },
    ];
    const matches = (c: Item) =>
      !nq || normalize(`${typeof c.label === 'string' ? c.label : ''} ${c.keywords ?? ''}`).includes(nq);
    const cmd = commands.filter(matches);
    out.push(...(nq ? cmd.slice(0, 6) : cmd.slice(0, 10)));

    // 3. events
    const now = new Date();
    const cal = (id: string) => calendars.find((c) => c.id === id);
    if (nq.length >= 2) {
      const found = events
        .filter((e) => normalize(`${e.title} ${e.location ?? ''} ${e.description ?? ''}`).includes(nq))
        .map((e) => {
          // for recurring events jump to the next occurrence
          const next = e.recurrence ? expandEvent(e, startOfDay(now), addDays(now, 400))[0] : null;
          return { e, start: next?.start ?? new Date(e.start), key: next?.key ?? e.id };
        })
        .sort((a, b) => Math.abs(a.start.getTime() - now.getTime()) - Math.abs(b.start.getTime() - now.getTime()))
        .slice(0, 8);
      for (const f of found) {
        out.push({
          id: `ev-${f.key}`,
          group: 'Eventi',
          icon: <i className="dot-icon" style={{ background: colorHex(f.e.color ?? cal(f.e.calendarId)?.color) }} />,
          label: f.e.title || 'Senza titolo',
          hint: `${fmtMediumDate(f.start)}${f.e.allDay ? '' : ` · ${fmtTime(f.start)}`}`,
          run: () => {
            const s = st();
            s.setCursor(f.start);
            if (s.view === 'year') s.setView('week');
            s.select(f.key);
          },
        });
      }
    }
    if (createItem && !strong) out.push(createItem);
    return out;
  }, [q, parsed, events, calendars, settings.hideWeekends, st]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.pal-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runItem = (it: Item) => {
    close();
    it.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = items[active];
      if (it) runItem(it);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  let lastGroup = '';
  return (
    <div className="overlay" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pal-input">
          <Search size={17} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Cerca o scrivi: “Pranzo con Anna domani alle 13 @Da Mario #personale”"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="pal-list" ref={listRef}>
          {items.length === 0 && <div className="pal-empty">Nessun risultato</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <div className="pal-group">{header}</div>}
                <button
                  className={cls('pal-item', { active: i === active, create: it.id === 'create' })}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => runItem(it)}
                >
                  <span className="pal-icon">{it.icon}</span>
                  <span className="pal-label">{it.label}</span>
                  {it.hint && <span className="pal-hint">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="pal-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> naviga
          </span>
          <span>
            <kbd>↵</kbd> esegui
          </span>
          <span className="pal-tip">
            Suggerimento: “Palestra ogni martedì alle 19 per 1h”, “Ferie 12/08 tutto il giorno”
          </span>
        </div>
      </div>
    </div>
  );
}
