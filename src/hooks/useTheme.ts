import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { colorHex } from '../lib/colors';
import { desktop } from '../lib/desktop';

const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

export function useResolvedTheme(): 'dark' | 'light' {
  const theme = useStore((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(() => mq().matches);
  useEffect(() => {
    const m = mq();
    const fn = () => setSystemDark(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/** Applies theme + accent color to <html> */
export function useApplyTheme() {
  const resolved = useResolvedTheme();
  const accent = useStore((s) => s.settings.accent);
  const panelOpen = useStore((s) => s.rightPanel !== null);
  const source = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.setProperty('--accent', colorHex(accent));
    root.style.colorScheme = resolved;
  }, [resolved, accent]);
  // desktop app: the Windows caption buttons sit over the top bar or the side panel
  useEffect(() => {
    desktop?.setChrome(resolved, panelOpen, source);
  }, [resolved, panelOpen, source]);
}
