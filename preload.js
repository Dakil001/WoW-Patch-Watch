'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('patchWatch', {
  getState: () => ipcRenderer.invoke('state:get'),
  refresh: () => ipcRenderer.invoke('data:refresh'),
  updateEntry: (gameId, patch) => ipcRenderer.invoke('entry:update', { gameId, patch }),
  setTrackEnabled: (gameId, enabled) => ipcRenderer.invoke('track:set-enabled', { gameId, enabled }),
  saveTrack: (track) => ipcRenderer.invoke('track:save', track),
  deleteTrack: (gameId) => ipcRenderer.invoke('track:delete', { gameId }),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  testEmail: () => ipcRenderer.invoke('email:test'),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  quit: () => ipcRenderer.invoke('app:quit'),
  setVisibleCardCount: (count) => ipcRenderer.invoke('window:set-visible-card-count', { count }),
  onRefreshStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('refresh:status', listener);
    return () => ipcRenderer.removeListener('refresh:status', listener);
  },
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  onUiCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on('ui:command', listener);
    return () => ipcRenderer.removeListener('ui:command', listener);
  }
});
