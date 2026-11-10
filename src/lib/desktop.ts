/** Bridge exposed by electron/preload.cjs (undefined when running in a normal browser) */
interface DesktopApi {
  platform: string;
  setChrome: (theme: 'dark' | 'light', panel: boolean, source: 'system' | 'dark' | 'light') => void;
  focusWindow: () => void;
}

export const desktop = (window as unknown as { orbitDesktop?: DesktopApi }).orbitDesktop;
