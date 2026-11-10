import { ChartColumn, ChevronLeft, ChevronRight, Moon, PanelLeft, Search, Share2, Sun } from 'lucide-react';
import { useStore } from '../store/useStore';
import { VIEW_KEY, VIEW_LABEL, viewTitle, viewRange } from '../lib/view';
import { cls } from '../lib/cls';
import type { ViewType } from '../types';
import { useResolvedTheme } from '../hooks/useTheme';

const VIEWS: ViewType[] = ['day', '3day', 'week', 'month', 'year', 'agenda'];

export function TopBar() {
  const view = useStore((s) => s.view);
  const cursorMs = useStore((s) => s.cursor);
  const settings = useStore((s) => s.settings);
  const setView = useStore((s) => s.setView);
  const step = useStore((s) => s.step);
  const goToday = useStore((s) => s.goToday);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setPalette = useStore((s) => s.setPalette);
  const rightPanel = useStore((s) => s.rightPanel);
  const toggleInsights = useStore((s) => s.toggleInsights);
  const availability = useStore((s) => s.availability.active);
  const setAvailability = useStore((s) => s.setAvailability);
  const updateSettings = useStore((s) => s.updateSettings);
  const theme = useResolvedTheme();

  const cursor = new Date(cursorMs);
  const title = viewTitle(view, cursor, settings);
  const r = viewRange(view, cursor, settings);
  const now = new Date();
  const showingToday = now >= r.start && now < r.end;

  return (
    <header className="topbar">
      <div className="tb-left">
        <button
          className={cls('icon-btn', { active: sidebarOpen })}
          onClick={toggleSidebar}
          data-tip="Barra laterale ( [ )"
          aria-label="Mostra/nascondi barra laterale"
        >
          <PanelLeft size={17} />
        </button>
        <button className={cls('btn', { subtle: showingToday })} onClick={goToday} data-tip="Vai a oggi (T)">
          Oggi
        </button>
        <div className="tb-nav">
          <button className="icon-btn" onClick={() => step(-1)} data-tip="Precedente (K / ←)" aria-label="Precedente">
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" onClick={() => step(1)} data-tip="Successivo (J / →)" aria-label="Successivo">
            <ChevronRight size={18} />
          </button>
        </div>
        <h1 className="tb-title">
          {title.main}
          {title.sub && <span>{title.sub}</span>}
        </h1>
      </div>

      <div className="tb-right">
        <button className="search-btn" onClick={() => setPalette(true)}>
          <Search size={14} />
          <span>Cerca o crea con il linguaggio naturale…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button
          className={cls('icon-btn', { active: availability })}
          onClick={() => setAvailability(!availability)}
          data-tip="Condividi disponibilità (S)"
          aria-label="Condividi disponibilità"
        >
          <Share2 size={16} />
        </button>
        <button
          className={cls('icon-btn', { active: rightPanel === 'insights' })}
          onClick={toggleInsights}
          data-tip="Analisi del tempo (I)"
          aria-label="Analisi del tempo"
        >
          <ChartColumn size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
          data-tip={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          aria-label="Cambia tema"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <select className="input view-select" value={view} onChange={(e) => setView(e.target.value as ViewType)}>
          {VIEWS.map((v) => (
            <option key={v} value={v}>
              {VIEW_LABEL[v]}
            </option>
          ))}
        </select>
        <div className="seg" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={cls('seg-btn', { active: view === v })}
              onClick={() => setView(v)}
              data-tip={`Tasto ${VIEW_KEY[v]}`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
