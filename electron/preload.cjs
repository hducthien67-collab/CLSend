/**
 * ClSend Electron Preload Script
 * 
 * Safely exposes desktop native capabilities to the React web application
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  sendNotification: (title, body) => {
    ipcRenderer.send('desktop-notify', { title, body });
  },
  minimize: () => {
    ipcRenderer.send('window-minimize');
  },
  maximize: () => {
    ipcRenderer.send('window-maximize');
  },
  close: () => {
    ipcRenderer.send('window-close');
  },
  focusWindow: () => {
    ipcRenderer.send('window-focus');
  },
  getDesktopPort: () => ipcRenderer.invoke('get-desktop-port'),
  openGoogleLogin: (port) => {
    ipcRenderer.send('open-google-login', port);
  },
  onGoogleLogin: (callback) => {
    ipcRenderer.on('desktop-google-login', (_event, data) => callback(data));
  },
});
