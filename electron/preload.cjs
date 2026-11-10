const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbitDesktop', {
  platform: process.platform,
  /** keeps the Windows caption buttons in sync with the app theme */
  setChrome: (theme, panel, source) => ipcRenderer.send('chrome', { theme, panel, source }),
  focusWindow: () => ipcRenderer.send('focus-window'),
});
