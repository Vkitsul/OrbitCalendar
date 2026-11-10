import { useStore } from './store/useStore';
import { Sidebar } from './components/sidebar/Sidebar';
import { TopBar } from './components/TopBar';
import { TimeGridView } from './components/views/TimeGridView';
import { MonthView } from './components/views/MonthView';
import { AgendaView } from './components/views/AgendaView';
import { YearView } from './components/views/YearView';
import { EventPanel } from './components/EventPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { CommandPalette } from './components/CommandPalette';
import { AvailabilityBar, SettingsModal, ShortcutsModal, Toasts } from './components/Modals';
import { useApplyTheme } from './hooks/useTheme';
import { useShortcuts } from './hooks/useShortcuts';
import { useReminders } from './hooks/useReminders';
import { gridDays } from './lib/view';
import { cls } from './lib/cls';

export default function App() {
  useApplyTheme();
  useShortcuts();
  useReminders();

  const view = useStore((s) => s.view);
  const cursor = useStore((s) => s.cursor);
  const settings = useStore((s) => s.settings);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const rightPanel = useStore((s) => s.rightPanel);
  const availability = useStore((s) => s.availability.active);

  let content: React.ReactNode;
  if (view === 'month') content = <MonthView />;
  else if (view === 'agenda') content = <AgendaView />;
  else if (view === 'year') content = <YearView />;
  else content = <TimeGridView days={gridDays(view, new Date(cursor), settings)} />;

  return (
    <div className={cls('app', { 'no-sidebar': !sidebarOpen, 'has-panel': !!rightPanel, 'avail-active': availability })}>
      {sidebarOpen && <Sidebar />}
      <main className="main">
        <TopBar />
        <div className="view" key={view}>
          {content}
        </div>
        <AvailabilityBar />
      </main>
      {rightPanel === 'event' && <EventPanel />}
      {rightPanel === 'insights' && <InsightsPanel />}
      <CommandPalette />
      <SettingsModal />
      <ShortcutsModal />
      <Toasts />
    </div>
  );
}
