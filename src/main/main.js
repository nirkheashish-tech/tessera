/**
 * Tessera — Main Process
 * A powerful, open-source multi-pane web app wrapper.
 */

const { app, BrowserWindow, globalShortcut, ipcMain, Menu, shell, nativeTheme, Notification } = require('electron');
const path = require('path');
const { store } = require('./store');

// ─── Hardware acceleration toggle ───────────────────────────────────────────
if (!store.get('advanced.hardwareAcceleration')) {
  app.disableHardwareAcceleration();
}

// ─── Proxy ──────────────────────────────────────────────────────────────────
const proxyRules = store.get('privacy.proxy');

// ─── State ──────────────────────────────────────────────────────────────────
let mainWindow = null;
let settingsWindow = null;

// ─── URL / Domain helpers ───────────────────────────────────────────────────

function buildInAppHostRegex() {
  const domains = store.get('auth.inAppDomains') || [];
  if (domains.length === 0) return null;
  // Support wildcard: *.example.com -> (^|\.)example\.com$
  const parts = domains.map(d => {
    d = d.trim().toLowerCase();
    if (d.startsWith('*.')) d = d.slice(2);
    return d.replace(/\./g, '\\.');
  }).filter(Boolean);
  if (parts.length === 0) return null;
  return new RegExp('(?:^|\\.)(' + parts.join('|') + ')$', 'i');
}

function buildExternalHostRegex() {
  const domains = store.get('auth.externalDomains') || [];
  if (domains.length === 0) return null;
  const parts = domains.map(d => {
    d = d.trim().toLowerCase();
    if (d.startsWith('*.')) d = d.slice(2);
    return d.replace(/\./g, '\\.');
  }).filter(Boolean);
  if (parts.length === 0) return null;
  return new RegExp('(?:^|\\.)(' + parts.join('|') + ')$', 'i');
}

let inAppHostRe = buildInAppHostRegex();
let externalHostRe = buildExternalHostRegex();

function rebuildRegexes() {
  inAppHostRe = buildInAppHostRegex();
  externalHostRe = buildExternalHostRegex();
}

function getAuthPathRe() {
  const keywords = store.get('auth.authPathKeywords') || [];
  if (keywords.length === 0) return null;
  return new RegExp(keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
}

function shouldStayInApp(url) {
  if (!url) return true;
  if (url.startsWith('file://') || url.startsWith('devtools://') || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;

  try {
    const u = new URL(url);

    // Check external blocklist first (always send to browser)
    if (externalHostRe && externalHostRe.test(u.hostname)) return false;

    // If no in-app allowlist is configured, everything stays in-app
    if (!inAppHostRe) return true;

    // Check in-app allowlist
    if (inAppHostRe.test(u.hostname)) return true;

    // Check auth path keywords
    const authRe = getAuthPathRe();
    if (authRe && authRe.test(u.pathname + u.search)) return true;
  } catch (_) {
    return true;
  }
  return false;
}

function isDefaultDomainUrl(url) {
  const defaultUrl = store.get('general.defaultUrl');
  if (!defaultUrl) return true;
  try {
    const defaultHost = new URL(defaultUrl).hostname;
    const targetHost = new URL(url).hostname;
    return targetHost === defaultHost || targetHost.endsWith('.' + defaultHost);
  } catch (_) {
    return true;
  }
}

// ─── Window creation ────────────────────────────────────────────────────────

function createMainWindow() {
  const savedBounds = store.get('_session.windowBounds');
  const theme = store.get('general.theme');

  if (theme === 'dark') nativeTheme.themeSource = 'dark';
  else if (theme === 'light') nativeTheme.themeSource = 'light';
  else nativeTheme.themeSource = 'system';

  mainWindow = new BrowserWindow({
    width: savedBounds?.width || 1400,
    height: savedBounds?.height || 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 500,
    title: store.get('general.appName') || 'Tessera',
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#f3f4f6',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
      spellcheck: store.get('advanced.spellCheck')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Save window bounds on resize/move
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('_session.windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    title: 'Tessera Settings',
    titleBarStyle: 'hiddenInset',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '..', 'settings', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Rebuild regexes in case domains changed
    rebuildRegexes();
    // Notify main window that settings changed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-changed', store.store);
    }
  });
}

// ─── Toggle window (global hotkey) ─────────────────────────────────────────

function toggleWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
    if (process.platform === 'darwin') app.hide();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── Global hotkey ──────────────────────────────────────────────────────────

function registerGlobalHotkey() {
  globalShortcut.unregisterAll();
  const hotkey = store.get('shortcuts.globalToggle');
  if (hotkey) {
    const ok = globalShortcut.register(hotkey, toggleWindow);
    if (!ok) console.warn(`Failed to register global hotkey: ${hotkey}`);
  }
}

// ─── App menu ───────────────────────────────────────────────────────────────

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const appName = store.get('general.appName') || 'Tessera';

  const template = [
    ...(isMac ? [{
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings…',
          accelerator: store.get('shortcuts.openSettings') || 'CmdOrCtrl+,',
          click: () => createSettingsWindow()
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Pane',
          accelerator: store.get('shortcuts.newPane'),
          click: () => mainWindow?.webContents.send('menu', 'new-pane')
        },
        {
          label: 'Close Pane',
          accelerator: store.get('shortcuts.closePane'),
          click: () => mainWindow?.webContents.send('menu', 'close-pane')
        },
        { type: 'separator' },
        {
          label: 'Split Vertical',
          accelerator: store.get('shortcuts.splitVertical'),
          click: () => mainWindow?.webContents.send('menu', 'split-vertical')
        },
        {
          label: 'Split Horizontal',
          accelerator: store.get('shortcuts.splitHorizontal'),
          click: () => mainWindow?.webContents.send('menu', 'split-horizontal')
        },
        { type: 'separator' },
        ...(!isMac ? [{
          label: 'Settings…',
          accelerator: store.get('shortcuts.openSettings') || 'CmdOrCtrl+,',
          click: () => createSettingsWindow()
        }, { type: 'separator' }] : []),
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Active Pane',
          accelerator: store.get('shortcuts.reloadPane'),
          click: () => mainWindow?.webContents.send('menu', 'reload-pane')
        },
        {
          label: 'Hard Reload Active Pane',
          accelerator: store.get('shortcuts.hardReloadPane'),
          click: () => mainWindow?.webContents.send('menu', 'reload-pane-hard')
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: store.get('shortcuts.toggleDevTools'),
          click: () => mainWindow?.webContents.send('menu', 'toggle-devtools')
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `Toggle window (${store.get('shortcuts.globalToggle')})`,
          click: toggleWindow
        },
        { type: 'separator' },
        {
          label: 'Tessera on GitHub',
          click: () => shell.openExternal('https://github.com/AshishSardana/tessera')
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Web contents link routing ──────────────────────────────────────────────

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (shouldStayInApp(url)) {
      // For SSO popups, allow a child window with shared cookies
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 720,
          webPreferences: { partition: store.get('auth.cookiePartition') || 'persist:tessera' }
        }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (shouldStayInApp(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });

  contents.on('will-redirect', (event, url) => {
    if (shouldStayInApp(url)) return;
    event.preventDefault();
    shell.openExternal(url);
  });
});

// ─── Single instance lock ───────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── App ready ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Apply proxy
  if (proxyRules) {
    const ses = require('electron').session.defaultSession;
    await ses.setProxy({ proxyRules });
  }

  // Apply user agent
  const ua = store.get('privacy.userAgent');
  if (ua) {
    app.userAgentFallback = ua;
  }

  buildAppMenu();
  createMainWindow();
  registerGlobalHotkey();

  // Launch at login
  if (store.get('general.launchAtLogin')) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();

  // Clear data on quit if configured
  if (store.get('privacy.clearDataOnQuit') || store.get('auth.clearCookiesOnQuit')) {
    const ses = require('electron').session.defaultSession;
    ses.clearStorageData();
  }
});

// ─── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => ({
  defaultUrl: store.get('general.defaultUrl'),
  appName: store.get('general.appName'),
  theme: store.get('general.theme'),
  accentColor: store.get('general.accentColor'),
  showUrlBar: store.get('navigation.showUrlBar'),
  allowNavigationAway: store.get('navigation.allowNavigationAway'),
  showHomepageButton: store.get('navigation.showHomepageButton'),
  paneHeaderVisibility: store.get('layout.paneHeaderVisibility'),
  resizerThickness: store.get('layout.resizerThickness'),
  newPanePosition: store.get('layout.newPanePosition'),
  tabMode: store.get('layout.tabMode'),
  maxPanes: store.get('layout.maxPanes'),
  defaultLayout: store.get('layout.defaultLayout'),
  startBehavior: store.get('general.startBehavior'),
  cookiePartition: store.get('auth.cookiePartition'),
  customCSS: store.get('advanced.customCSS'),
  customJS: store.get('advanced.customJS'),
  devToolsEnabled: store.get('advanced.devToolsEnabled'),
  shortcuts: store.get('shortcuts'),
  notifications: store.get('notifications')
}));

ipcMain.handle('open-external', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch (e) {
    console.error('Failed to open external URL:', url, e);
    return false;
  }
});

ipcMain.handle('open-in-new-pane', (_event, url) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-in-new-pane', url);
  }
  return true;
});

ipcMain.handle('should-stay-in-app', (_event, url) => {
  return shouldStayInApp(url);
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
  return true;
});

// Settings IPC
ipcMain.handle('settings-get-all', () => {
  return store.store;
});

ipcMain.handle('settings-set', (_event, key, value) => {
  store.set(key, value);

  // Re-register hotkey if it changed
  if (key === 'shortcuts.globalToggle') {
    registerGlobalHotkey();
  }

  // Rebuild menu if shortcuts or app name changed
  if (key.startsWith('shortcuts.') || key === 'general.appName') {
    buildAppMenu();
  }

  // Update theme
  if (key === 'general.theme') {
    if (value === 'dark') nativeTheme.themeSource = 'dark';
    else if (value === 'light') nativeTheme.themeSource = 'light';
    else nativeTheme.themeSource = 'system';
  }

  // Rebuild domain regexes
  if (key.startsWith('auth.')) {
    rebuildRegexes();
  }

  // Notify main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-changed', store.store);
  }

  return true;
});

ipcMain.handle('settings-reset', () => {
  store.clear();
  rebuildRegexes();
  registerGlobalHotkey();
  buildAppMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-changed', store.store);
  }
  return true;
});

ipcMain.handle('settings-export', () => {
  return JSON.stringify(store.store, null, 2);
});

ipcMain.handle('settings-import', (_event, jsonStr) => {
  try {
    const data = JSON.parse(jsonStr);
    store.store = data;
    rebuildRegexes();
    registerGlobalHotkey();
    buildAppMenu();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
