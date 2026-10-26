/**
 * ClSend Desktop Application Entry Point (Electron)
 * 
 * Features:
 * - Windows System Tray with context menu
 * - Minimize to tray on close (run in background for incoming messages/files)
 * - Auto-start with Windows toggle
 * - Native desktop notifications
 * - Single instance lock
 */

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
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

function resolveAssetPath(relativePath) {
  const possiblePaths = [
    path.join(__dirname, '..', relativePath),
    path.join(__dirname, '..', 'dist', relativePath),
    path.join(__dirname, '..', 'public', relativePath),
    path.join(process.resourcesPath || '', relativePath),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '..', 'public', 'pwa-512x512.png');
}

function createMainWindow() {
  const iconPath = resolveAssetPath('pwa-512x512.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 420,
    minHeight: 600,
    title: 'ClSend',
    icon: iconPath,
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load URL or local index.html
  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
  }

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'ClSend vẫn đang hoạt động',
          content: 'Ứng dụng đã thu nhỏ xuống khay hệ thống để tiếp tục nhận tin nhắn và tệp.',
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  if (tray) return;

  const iconPath = resolveAssetPath('pwa-192x192.png');
  tray = new Tray(iconPath);
  tray.setToolTip('ClSend - Truyền tệp siêu tốc & Chat trực tuyến');

  const updateContextMenu = () => {
    const loginItemSettings = app.getLoginItemSettings();
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Mở ClSend',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Trạng thái: Đang trực tuyến',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Khởi chạy cùng Windows',
        type: 'checkbox',
        checked: loginItemSettings.openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            openAsHidden: true,
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Thoát ứng dụng',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.focus();
        }
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Setup IPC handlers
ipcMain.on('desktop-notify', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    const iconPath = resolveAssetPath('pwa-192x192.png');
    const notification = new Notification({
      title: title || 'ClSend',
      body: body || '',
      icon: iconPath,
    });

    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window-focus', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep app running in background unless explicitly quit
    if (isQuitting) {
      app.quit();
    }
  }
});
