import { Keyboard, Plus, Settings } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MiniCalendar } from './MiniCalendar';
import { UpNext } from './UpNext';
import { CalendarList } from './CalendarList';
import { TaskInbox } from './TaskInbox';
import { newEventDraft } from '../../lib/actions';

export function Sidebar() {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setShortcutsOpen = useStore((s) => s.setShortcutsOpen);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">
          <span />
        </div>
        <span className="brand-name">Orbit</span>
        <button className="btn primary sm new-btn" onClick={newEventDraft} data-tip="Nuovo evento (C)">
          <Plus size={14} strokeWidth={2.5} /> Nuovo
        </button>
      </div>
      <div className="side-scroll">
        <MiniCalendar />
        <UpNext />
        <CalendarList />
        <TaskInbox />
      </div>
      <div className="side-foot">
        <button className="btn ghost sm" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={14} /> Scorciatoie <kbd>?</kbd>
        </button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} data-tip="Impostazioni">
          <Settings size={15} />
        </button>
      </div>
    </aside>
  );
}
