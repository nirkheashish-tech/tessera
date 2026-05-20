/**
 * Tessera Settings Store
 * Persistent settings using electron-store with all 10 customization categories.
 */

const Store = require('electron-store');

const defaults = {
  // ═══════════════════════════════════════════════════════════════
  // 1. GENERAL / APP IDENTITY
  // ═══════════════════════════════════════════════════════════════
  general: {
    appName: 'Tessera',
    defaultUrl: 'https://example.com',
    theme: 'system', // 'light' | 'dark' | 'system'
    accentColor: '#2563eb',
    startBehavior: 'single', // 'single' | 'restore' | 'custom'
    startPaneCount: 1,
    launchAtLogin: false
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. PER-PANE URL & NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  navigation: {
    showUrlBar: true,
    allowNavigationAway: true, // allow panes to navigate away from default domain
    showHomepageButton: true,
    paneBookmarks: [] // [{ name, url, paneId? }]
  },

  // ═══════════════════════════════════════════════════════════════
  // 3. AUTHENTICATION / SSO
  // ═══════════════════════════════════════════════════════════════
  auth: {
    inAppDomains: [], // domains that stay in-app (supports wildcards like *.company.com)
    externalDomains: [], // domains forced to system browser even if on allowlist
    authPathKeywords: [
      'oauth', 'openid', 'oidc', 'login', 'signin', 'sign-in',
      'sso', 'auth', 'authenticate', 'authorize', 'callback',
      'return_to', 'saml', 'next='
    ],
    cookiePartition: 'persist:tessera',
    clearCookiesOnQuit: false
  },

  // ═══════════════════════════════════════════════════════════════
  // 4. EXTERNAL LINK BEHAVIOR
  // ═══════════════════════════════════════════════════════════════
  links: {
    defaultAction: 'browser', // 'browser' | 'new-pane' | 'ask'
    modifierKeys: true, // Cmd+click = browser, Opt+click = new pane
    popupHandling: 'allow-allowlisted' // 'allow-all' | 'allow-allowlisted' | 'block-all'
  },

  // ═══════════════════════════════════════════════════════════════
  // 5. LAYOUT & PANES
  // ═══════════════════════════════════════════════════════════════
  layout: {
    defaultLayout: 'single', // 'single' | '2-vertical' | '2-horizontal' | '2x2' | 'custom'
    maxPanes: 0, // 0 = unlimited
    paneHeaderVisibility: 'always', // 'always' | 'hover' | 'hidden'
    resizerThickness: 'normal', // 'thin' | 'normal' | 'thick'
    newPanePosition: 'right', // 'right' | 'below' | 'end'
    tabMode: false // enable tab bar in addition to split panes
  },

  // ═══════════════════════════════════════════════════════════════
  // 6. GLOBAL HOTKEY & SHORTCUTS
  // ═══════════════════════════════════════════════════════════════
  shortcuts: {
    globalToggle: 'Alt+Space',
    newPane: 'CmdOrCtrl+T',
    closePane: 'CmdOrCtrl+W',
    splitVertical: 'CmdOrCtrl+\\',
    splitHorizontal: 'CmdOrCtrl+Shift+\\',
    cyclePaneNext: 'CmdOrCtrl+]',
    cyclePanePrev: 'CmdOrCtrl+[',
    reloadPane: 'CmdOrCtrl+R',
    hardReloadPane: 'CmdOrCtrl+Shift+R',
    toggleDevTools: 'Alt+CmdOrCtrl+I',
    openSettings: 'CmdOrCtrl+,'
  },

  // ═══════════════════════════════════════════════════════════════
  // 7. PRIVACY & DATA
  // ═══════════════════════════════════════════════════════════════
  privacy: {
    userAgent: '', // empty = default Chromium UA
    proxy: '', // empty = system proxy; format: 'http://host:port' or 'socks5://host:port'
    doNotTrack: false,
    persistentCookies: true,
    clearDataOnQuit: false,
    cacheSizeMB: 500
  },

  // ═══════════════════════════════════════════════════════════════
  // 8. NOTIFICATIONS & BADGES
  // ═══════════════════════════════════════════════════════════════
  notifications: {
    enabled: true,
    dockBadge: true,
    sound: true
  },

  // ═══════════════════════════════════════════════════════════════
  // 9. ADVANCED / DEVELOPER
  // ═══════════════════════════════════════════════════════════════
  advanced: {
    devToolsEnabled: true,
    customCSS: '', // CSS injected into every pane
    customJS: '', // JS injected on page load in every pane
    preloadScriptPath: '', // path to custom preload script
    hardwareAcceleration: true,
    spellCheck: true,
    spellCheckLanguage: 'en-US'
  },

  // ═══════════════════════════════════════════════════════════════
  // 10. PROFILES
  // ═══════════════════════════════════════════════════════════════
  profiles: {
    active: 'default',
    list: [
      {
        id: 'default',
        name: 'Default',
        defaultUrl: '',
        cookiePartition: 'persist:tessera',
        inAppDomains: [],
        customCSS: '',
        customJS: ''
      }
    ]
  },

  // Session state (not user-editable, used for restore)
  _session: {
    windowBounds: null,
    paneTree: null
  }
};

const store = new Store({
  name: 'tessera-settings',
  defaults,
  clearInvalidConfig: true
});

module.exports = { store, defaults };
