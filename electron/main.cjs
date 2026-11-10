const { app, BrowserWindow, ipcMain, Menu, nativeTheme, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';
const DEV_ICON = path.join(__dirname, '..', 'build', 'icon.ico');

// Colors of the area behind the Windows caption buttons, per theme and layout
const CHROME = {
  dark: { bg: '#161618', panel: '#1c1c1f', symbol: '#a3a3ad' },
  light: { bg: '#ffffff', panel: '#f7f7f5', symbol: '#5e5e66' },
};
const CAPTION_HEIGHT = 40;

app.setAppUserModelId('com.orbit.calendar');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ---------- window state (size, position, theme) ----------
const statePath = () => path.join(app.getPath('userData'), 'window-state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveState(patch) {
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ ...loadState(), ...patch }));
  } catch {
    /* ignore */
  }
}

function visibleOnSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y,
  );
}

let win = null;

function createWindow() {
  const state = loadState();
  const theme = state.theme === 'light' ? 'light' : 'dark';
  const area = screen.getPrimaryDisplay().workAreaSize;
  const bounds =
    state.bounds && visibleOnSomeDisplay(state.bounds)
      ? state.bounds
      : { width: Math.min(1480, area.width - 40), height: Math.min(920, area.height - 40) };

  nativeTheme.themeSource = state.themeSource || theme;

  win = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Orbit Calendar',
    backgroundColor: CHROME[theme].bg,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: CHROME[theme].bg, symbolColor: CHROME[theme].symbol, height: CAPTION_HEIGHT },
    // packaged builds use the icon embedded in the .exe
    ...(fs.existsSync(DEV_ICON) ? { icon: DEV_ICON } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // links (meetings, maps…) open in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = isDev ? url.startsWith(DEV_URL) : url.startsWith('file:');
    if (!allowed) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  // right-click menu for text fields and selections
  win.webContents.on('context-menu', (_e, p) => {
    if (!p.isEditable && !p.selectionText) return;
    const items = [];
    if (p.isEditable && p.dictionarySuggestions?.length) {
      for (const s of p.dictionarySuggestions.slice(0, 4)) {
        items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) });
      }
      items.push({ type: 'separator' });
    }
    if (p.isEditable) items.push({ label: 'Taglia', role: 'cut', enabled: p.editFlags.canCut });
    items.push({ label: 'Copia', role: 'copy', enabled: p.editFlags.canCopy });
    if (p.isEditable) {
      items.push({ label: 'Incolla', role: 'paste', enabled: p.editFlags.canPaste });
      items.push({ type: 'separator' }, { label: 'Seleziona tutto', role: 'selectAll' });
    }
    Menu.buildFromTemplate(items).popup({ window: win });
  });

  // dev tools only in dev mode
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (isDev && (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i'))) {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });

  const persistBounds = () => {
    if (!win || win.isDestroyed()) return;
    saveState({ maximized: win.isMaximized(), bounds: win.getNormalBounds() });
  };
  win.on('close', persistBounds);
  win.on('closed', () => {
    win = null;
  });
}

// renderer tells us the theme / whether the side panel is under the caption buttons
ipcMain.on('chrome', (_e, { theme, panel, source }) => {
  if (!win) return;
  const t = theme === 'light' ? 'light' : 'dark';
  const src = ['system', 'dark', 'light'].includes(source) ? source : t;
  if (nativeTheme.themeSource !== src) nativeTheme.themeSource = src;
  const c = CHROME[t];
  win.setBackgroundColor(c.bg);
  try {
    win.setTitleBarOverlay({ color: panel ? c.panel : c.bg, symbolColor: c.symbol, height: CAPTION_HEIGHT });
  } catch {
    /* overlay not supported */
  }
  saveState({ theme: t, themeSource: src });
});

ipcMain.on('focus-window', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
