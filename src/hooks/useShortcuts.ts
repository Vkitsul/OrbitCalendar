import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { ViewType } from '../types';
import { newEventDraft, protectFocusTime } from '../lib/actions';

const VIEW_KEYS: Record<string, ViewType> = { d: 'day', '3': '3day', w: 'week', m: 'month', y: 'year', a: 'agenda' };

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
};

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'k') {
        e.preventDefault();
        s.setPalette(!s.paletteOpen);
        return;
      }
      if (s.paletteOpen || s.settingsOpen || s.shortcutsOpen) return;

      if (mod && key === 'z' && !isTyping(e.target)) {
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod && key === 'd' && s.selectedKey && !isTyping(e.target)) {
        e.preventDefault();
        s.duplicateOccurrence(s.selectedKey);
        return;
      }
      if (e.key === 'Escape') {
        if (isTyping(e.target)) {
          (e.target as HTMLElement).blur();
          return;
        }
        if (s.availability.active) s.setAvailability(false);
        else if (s.rightPanel) s.closePanel();
        return;
      }
      if (isTyping(e.target) || mod || e.altKey) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedKey) {
        if (s.selectedKey.startsWith('hol-')) return;
        e.preventDefault();
        s.deleteOccurrence(s.selectedKey, 'one');
        return;
      }
      if (VIEW_KEYS[key] && !e.shiftKey) {
        s.setView(VIEW_KEYS[key]);
        return;
      }
      switch (e.key) {
        case 't':
        case 'T':
          s.goToday();
          break;
        case 'j':
        case 'J':
        case 'ArrowRight':
          s.step(1);
          break;
        case 'k':
        case 'K':
        case 'ArrowLeft':
          s.step(-1);
          break;
        case 'c':
        case 'C':
        case 'n':
        case 'N':
          e.preventDefault();
          newEventDraft();
          break;
        case 's':
        case 'S':
          s.setAvailability(!s.availability.active);
          break;
        case 'i':
        case 'I':
          s.toggleInsights();
          break;
        case 'f':
        case 'F':
          protectFocusTime();
          break;
        case '[':
        case '\\':
          s.toggleSidebar();
          break;
        case ',':
          s.setSettingsOpen(true);
          break;
        case '?':
          s.setShortcutsOpen(true);
          break;
        case '/':
          e.preventDefault();
          s.setPalette(true);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
