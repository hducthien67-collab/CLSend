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

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Chrome User-Agent without Electron tokens to ensure Google OAuth works directly inside the desktop app
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_USER_AGENT;

let currentLocalPort = null;

function startLocalServer(distPath) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];

      if (reqPath === '/google-login' || reqPath === '/google-login.html') {
        let firebaseConfig = {
          "projectId": "regal-server-kggh3",
          "appId": "1:419941443909:web:968e0f988b83655d0af62c",
          "apiKey": "AIzaSyB7iydXpFSwOU7pWzYVSyjhGuTKCuDJi2M",
          "authDomain": "regal-server-kggh3.firebaseapp.com",
          "firestoreDatabaseId": "ai-studio-clsend-f38ea8d5-1642-4834-b694-f45cc92a798c",
          "storageBucket": "regal-server-kggh3.firebasestorage.app",
          "messagingSenderId": "419941443909",
          "oAuthClientId": "419941443909-i3pvl9gk9hb28t5buhqi5j3q69joqgj8.apps.googleusercontent.com"
        };
        try {
          const possibleConfigPaths = [
            path.join(__dirname, '..', 'firebase-applet-config.json'),
            path.join(process.resourcesPath || '', 'firebase-applet-config.json'),
            path.join(app.getAppPath(), 'firebase-applet-config.json'),
          ];
          for (const p of possibleConfigPaths) {
            if (fs.existsSync(p)) {
              const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
              if (parsed && parsed.apiKey) {
                firebaseConfig = parsed;
                break;
              }
            }
          }
        } catch {}

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <title>Đăng nhập Google - ClSend Desktop</title>
            <style>
              body { background: #090d16; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #111827; border: 1px solid #1f2937; padding: 40px; border-radius: 20px; text-align: center; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
              h2 { color: #10B981; margin-bottom: 10px; font-size: 22px; }
              p { color: #9ca3af; font-size: 14px; line-height: 1.5; margin-bottom: 25px; }
              .btn { background: #10B981; color: #090d16; font-weight: bold; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-size: 15px; width: 100%; transition: opacity 0.2s; }
              .btn:hover { opacity: 0.9; }
              .loading { color: #34d399; font-size: 13px; margin-top: 15px; display: none; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>ClSend Desktop</h2>
              <p>Nhấn vào nút bên dưới để xác thực tài khoản Google của bạn an toàn.</p>
              <button class="btn" id="loginBtn" onclick="doLogin()">Đăng nhập với Google</button>
              <div class="loading" id="loadingText">Đang kết nối Google Auth...</div>
            </div>
            <script type="module">
              import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
              import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

              const firebaseConfig = ${JSON.stringify(firebaseConfig)};
              const app = initializeApp(firebaseConfig);
              const auth = getAuth(app);
              const provider = new GoogleAuthProvider();

              getRedirectResult(auth).then(async (res) => {
                if (res && res.user) {
                  const user = res.user;
                  window.location.href = '/auth-success?uid=' + encodeURIComponent(user.uid) + 
                    '&email=' + encodeURIComponent(user.email || '') + 
                    '&displayName=' + encodeURIComponent(user.displayName || '') + 
                    '&photoURL=' + encodeURIComponent(user.photoURL || '');
                }
              }).catch(err => {
                console.error(err);
              });

              window.doLogin = async () => {
                const btn = document.getElementById('loginBtn');
                const loading = document.getElementById('loadingText');
                btn.style.display = 'none';
                loading.style.display = 'block';
                try {
                  const res = await signInWithPopup(auth, provider);
                  const user = res.user;
                  if (user) {
                    window.location.href = '/auth-success?uid=' + encodeURIComponent(user.uid) + 
                      '&email=' + encodeURIComponent(user.email || '') + 
                      '&displayName=' + encodeURIComponent(user.displayName || '') + 
                      '&photoURL=' + encodeURIComponent(user.photoURL || '');
                  }
                } catch (err) {
                  try {
                    loading.innerText = 'Đang chuyển hướng sang Google Auth...';
                    await signInWithRedirect(auth, provider);
                  } catch (redirectErr) {
                    loading.style.color = '#f87171';
                    loading.innerText = 'Lỗi đăng nhập: ' + (redirectErr.message || err.message || err);
                    btn.style.display = 'block';
                  }
                }
              };
            </script>
          </body>
          </html>
        `);
        return;
      }

      if (reqPath === '/auth-success') {
        const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const uid = urlParams.get('uid');
        const email = urlParams.get('email');
        const displayName = urlParams.get('displayName');
        const photoURL = urlParams.get('photoURL');

        if (uid) {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('desktop-google-login', { uid, email, displayName, photoURL });
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body style="background:#090d16;color:#10B981;font-family:sans-serif;text-align:center;padding-top:50px;"><h2>Đăng nhập Google thành công!</h2><p>Bạn có thể đóng tab trình duyệt này và quay lại ứng dụng ClSend trên máy tính.</p></body></html>');
          return;
        }
      }

      let filePath = path.join(distPath, reqPath === '/' ? 'index.html' : reqPath);
      
      if (!filePath.startsWith(distPath)) {
        res.writeHead(403);
        res.end('Access denied');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || stats.isDirectory()) {
          filePath = path.join(distPath, 'index.html');
        }

        fs.readFile(filePath, (error, content) => {
          if (error) {
            res.writeHead(500);
            res.end('Server error');
          } else {
            const ext = path.extname(filePath).toLowerCase();
            let contentType = 'text/html';
            if (ext === '.js') contentType = 'application/javascript';
            else if (ext === '.css') contentType = 'text/css';
            else if (ext === '.json') contentType = 'application/json';
            else if (ext === '.png') contentType = 'image/png';
            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
            else if (ext === '.svg') contentType = 'image/svg+xml';
            else if (ext === '.woff' || ext === '.woff2') contentType = 'font/woff2';
            else if (ext === '.ico') contentType = 'image/x-icon';

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
          }
        });
      });
    });

    server.listen(0, 'localhost', () => {
      currentLocalPort = server.address().port;
      resolve(`http://localhost:${currentLocalPort}`);
    });
  });
}

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

  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);

  // Handle external links safely and allow Google / Firebase auth popups directly inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.includes('accounts.google.com') || 
      url.includes('firebaseapp.com') || 
      url.includes('google.com') ||
      url.includes('googleapis.com')
    ) {
      return { 
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 650,
          title: 'Đăng nhập Google - ClSend Desktop',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
          }
        }
      };
    }
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Load URL via local HTTP static server on 127.0.0.1 (so localhost / 127.0.0.1 is used, which is whitelisted by default in Firebase Auth for Google Sign-In)
  const devUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_START_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      startLocalServer(distPath).then((localUrl) => {
        mainWindow.loadURL(localUrl);
      }).catch(() => {
        mainWindow.loadFile(indexPath);
      });
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
    mainWindow.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedURL) => {
      if (validatedURL && validatedURL.includes('localhost:3000')) {
        mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>ClSend Desktop</title>
            <style>
              body { background: #020617; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
              .box { background: #0f172a; border: 1px solid #1e293b; border-radius: 20px; padding: 32px; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
              h2 { color: #10b981; margin: 0 0 12px; font-size: 22px; }
              p { color: #94a3b8; font-size: 13px; line-height: 1.6; margin-bottom: 20px; }
              .btn { display: inline-block; background: #10b981; color: #020617; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-size: 14px; margin: 6px; cursor: pointer; border: none; }
              code { background: #020617; color: #34d399; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="box">
              <h2>ClSend Desktop</h2>
              <p>Chưa tìm thấy máy chủ phát triển tại <code>http://localhost:3000</code> hoặc bản build <code>dist/</code> chưa sẵn sàng.</p>
              <p>Vui lòng chạy lệnh <code>npm run dev</code> hoặc <code>npm run build</code> trong terminal.</p>
              <button class="btn" onclick="location.href='http://localhost:3000'">Thử tải lại (Retry)</button>
            </div>
          </body>
          </html>
        `));
      }
    });
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

ipcMain.handle('get-desktop-port', () => {
  return currentLocalPort;
});

ipcMain.on('open-google-login', (_event, port) => {
  const targetPort = port || currentLocalPort;
  if (targetPort) {
    shell.openExternal(`http://localhost:${targetPort}/google-login`);
  }
});

app.whenReady().then(() => {
  // Ensure network requests to Google or Firebase OAuth use a clean Chrome User-Agent
  // so Google never triggers 403 disallowed_useragent
  try {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
  } catch (err) {
    console.warn('Session header rewrite error:', err);
  }

  // Always initialize local server for Google OAuth loopback fallback
  const distPath = path.join(__dirname, '..', 'dist');
  startLocalServer(distPath).catch(() => {});

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
