const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tessera', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openInNewPane: (url) => ipcRenderer.invoke('open-in-new-pane', url),
  shouldStayInApp: (url) => ipcRenderer.invoke('should-stay-in-app', url),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  onMenu: (callback) => ipcRenderer.on('menu', (_, action) => callback(action)),
  onOpenInNewPane: (callback) => ipcRenderer.on('open-in-new-pane', (_, url) => callback(url)),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_, settings) => callback(settings))
});
