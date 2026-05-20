const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tesseraSettings', {
  getAll: () => ipcRenderer.invoke('settings-get-all'),
  set: (key, value) => ipcRenderer.invoke('settings-set', key, value),
  reset: () => ipcRenderer.invoke('settings-reset'),
  export: () => ipcRenderer.invoke('settings-export'),
  import: (jsonStr) => ipcRenderer.invoke('settings-import', jsonStr)
});
