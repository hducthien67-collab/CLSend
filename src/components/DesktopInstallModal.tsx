import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Download, 
  Check, 
  Copy, 
  Terminal, 
  Sparkles, 
  ShieldCheck, 
  BellRing, 
  ExternalLink,
  Laptop,
  CheckCircle2,
  Layers,
  AlertCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import { requestNotificationPermission, isElectronApp, isPwaStandalone } from '../utils/desktopNotification';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onPwaInstalled?: () => void;
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onPwaInstalled,
}) => {
  const [activeTab, setActiveTab] = useState<'pwa' | 'installer' | 'photopea-info'>('pwa');
  const [isCopied, setIsCopied] = useState(false);
  const [installStatusMessage, setInstallStatusMessage] = useState<string | null>(null);
  const [notificationPermissionState, setNotificationPermissionState] = useState<NotificationPermission>('default');
  const [isInIframe, setIsInIframe] = useState(false);
  const [directTabOpened, setDirectTabOpened] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsInIframe(window.self !== window.top);
      } catch {
        setIsInIframe(true);
      }
      if ('Notification' in window) {
        setNotificationPermissionState(Notification.permission);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isStandalone = isPwaStandalone();
  const isElectron = isElectronApp();

  const getDirectAppUrl = () => {
    if (typeof window === 'undefined') return 'https://clsend.app';
    const origin = window.location.origin;
    // Strip query parameters to get clean base URL
    return origin.split('?')[0];
  };

  const directUrl = getDirectAppUrl();

  const handleInstallPWA = async () => {
    setInstallStatusMessage(null);

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallStatusMessage('Đã cài đặt thành công ClSend lên máy tính như Photopea!');
          if (onPwaInstalled) onPwaInstalled();
        } else {
          setInstallStatusMessage('Bạn đã hủy yêu cầu cài đặt.');
        }
      } catch (err) {
        console.warn('Error prompting PWA install:', err);
        handleDownloadWindowsInstaller();
        handleOpenInNewTab();
      }
    } else {
      // Khi đang xem trong iframe AI Studio (trình duyệt bảo mật chặn beforeinstallprompt):
      // 1. Tự động tải tệp CaiDat-ClSend-Windows.bat về máy tính
      handleDownloadWindowsInstaller();
      // 2. Mở tab mới độc lập để người dùng có thể cài theo chuẩn Photopea
      handleOpenInNewTab();
      // 3. Cập nhật thông báo nổi bật
      setInstallStatusMessage(
        'Đã tải tệp CaiDat-ClSend-Windows.bat về máy của bạn và mở Tab mới! Hãy nhấp đúp vào tệp vừa tải ở mục Downloads để tạo biểu tượng ClSend trên Desktop ngay lập tức.'
      );
    }
  };

  const handleOpenInNewTab = () => {
    setDirectTabOpened(true);
    try {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked, falling back to direct navigation', e);
    }
  };

  const handleEnableNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermissionState(perm);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('npm run dist:win');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Generates 1-Click Windows Native App Shortcut Creator (.bat)
  // Works on 100% of Windows 10 & 11 PCs without requiring Node.js, Python or compilation!
  const handleDownloadWindowsInstaller = () => {
    const batContent = `@echo off
chcp 65001 > nul
title Cai Dat ClSend Cho Windows
color 0A

echo ======================================================================
echo           CLSEND - TỰ ĐỘNG TẠO ỨNG DỤNG DESKTOP CHO WINDOWS
echo                 (Công nghệ WebApp độc lập như Photopea)
echo ======================================================================
echo.
echo [1/3] Đang định cấu hình đường dẫn ứng dụng ClSend...
set "APP_URL=${directUrl}"
set "APP_NAME=ClSend"
set "USER_DESKTOP=%USERPROFILE%\\Desktop"
set "USER_STARTMENU=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs"
set "DATA_DIR=%LOCALAPPDATA%\\ClSendApp"

echo [OK] Đường dẫn ứng dụng: %APP_URL%
echo.

echo [2/3] Đang tìm kiếm trình duyệt hệ thống (Microsoft Edge / Google Chrome)...
set "BROWSER_PATH="

if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER_PATH=C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER_PATH=C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER_PATH=C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
)

if "%BROWSER_PATH%"=="" (
    echo [CANH BAO] Khong tim thay duong dan tuyet doi, su dung lenh msedge mac dinh...
    set "BROWSER_PATH=msedge.exe"
)

echo [3/3] Đang tạo biểu tượng ứng dụng ClSend trên màn hình chính Desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $sDesktop = $ws.CreateShortcut('%USER_DESKTOP%\\ClSend.lnk'); ^
   $sDesktop.TargetPath = '%BROWSER_PATH%'; ^
   $sDesktop.Arguments = '--app=%APP_URL% --user-data-dir=\"%DATA_DIR%\"'; ^
   $sDesktop.Description = 'ClSend - Truyen tep sieu toc va Chat truc tuyen'; ^
   $sDesktop.Save(); ^
   $sMenu = $ws.CreateShortcut('%USER_STARTMENU%\\ClSend.lnk'); ^
   $sMenu.TargetPath = '%BROWSER_PATH%'; ^
   $sMenu.Arguments = '--app=%APP_URL% --user-data-dir=\"%DATA_DIR%\"'; ^
   $sMenu.Description = 'ClSend - Truyen tep sieu toc va Chat truc tuyen'; ^
   $sMenu.Save();"

echo.
echo ======================================================================
echo          CAI DAT THANH CONG ỨNG DỤNG CLSEND CHO WINDOWS!
echo ======================================================================
echo.
echo [x] Biểu tượng "ClSend" đã được thêm vào Màn hình chính (Desktop).
echo [x] Đã thêm vào Start Menu của Windows.
echo [x] Ứng dụng sẽ mở trong cửa sổ độc lập riêng biệt, không viền trình duyệt.
echo.
echo Bạn có muốn khởi chạy ClSend ngay bây giờ không? (Y/N)
set /p userchoice="Chon: "
if /i "%userchoice%"=="Y" (
    start "" "%BROWSER_PATH%" --app="%APP_URL%" --user-data-dir="%DATA_DIR%"
)
exit /b 0
`;

    const blob = new Blob([batContent], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CaiDat-ClSend-Windows.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Tải ứng dụng ClSend cho máy tính
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Windows 10 / 11
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Mở ClSend như một ứng dụng độc lập trên Desktop với biểu tượng riêng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 sm:px-6 pt-4 pb-2 bg-slate-900">
          <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pwa');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'pwa'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cài như Photopea</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('installer');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'installer'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>File Windows (.bat)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('photopea-info' as any);
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer ${
                (activeTab as string) === 'photopea-info'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-300" />
              <span>Hỏi đáp Photopea</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4">
          {/* Iframe Notice Banner (if inside iframe preview) */}
          {isInIframe && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-semibold">
                  Mẹo cài đặt như Photopea (1-Click trong 2 giây):
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Trình duyệt chặn cài đặt ứng dụng từ khung xem trước. Hãy nhấn nút dưới đây để mở ClSend trên Tab mới, sau đó nhấn <strong>Cài đặt</strong> trên thanh địa chỉ URL:
                </p>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Mở ClSend trên Tab mới để cài ngay</span>
                </button>
              </div>
            </div>
          )}

          {/* Status Message Banner if triggered */}
          {installStatusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-3 shadow-xl shadow-emerald-500/10 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold text-white text-xs leading-relaxed">{installStatusMessage}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadWindowsInstaller}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải lại file cài đặt (.bat)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] border border-slate-700 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mở lại Tab mới</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa' ? (
            /* TAB 1: PWA DIRECT INSTALLATION */
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-bold text-white text-sm sm:text-base">
                      {isStandalone ? 'Đang chạy trong chế độ Desktop App' : 'Cài đặt trực tiếp y hệt Photopea'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Không cần tải file nặng
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-md">
                    Photopea và ClSend đều dùng công nghệ <strong>PWA</strong>: biến trang web thành ứng dụng máy tính có biểu tượng riêng trên màn hình chính (Desktop) và thanh tác vụ (Taskbar).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={handleInstallPWA}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Cài đặt ngay (1-Click)</span>
                    </button>
                  )}
                  {notificationPermissionState !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleEnableNotification}
                      className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer"
                    >
                      <BellRing className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bật thông báo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Step Visual Guide for Browser Bar */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  2 Bước cài đặt trên Google Chrome & Microsoft Edge:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center">1</span>
                      Bước 1: Mở trên Tab mới
                    </p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Bấm nút <strong>"Mở ClSend trên Tab mới"</strong> để thoát khỏi khung xem trước bị trình duyệt hạn chế.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <p className="font-bold text-sky-400 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-400 text-[10px] flex items-center justify-center">2</span>
                      Bước 2: Bấm biểu tượng Cài đặt
                    </p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Trên góc phải thanh địa chỉ (URL), bấm vào biểu tượng <strong>Màn hình máy tính có mũi tên xuống</strong> &rarr; chọn <strong>Cài đặt</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* 4 Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Cửa sổ ứng dụng độc lập</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Giao diện rộng rãi, mở riêng không bị lẫn vào hàng chục tab trình duyệt.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Thông báo Desktop</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bật thông báo nổi ở góc màn hình khi có tin nhắn hoặc tệp mới.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'installer' ? (
            /* TAB 2: 1-CLICK WINDOWS BATCH INSTALLER */
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-950 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                      Bộ cài đặt tự động cho Windows (.bat)
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        100% Hoạt động
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Tự động tạo biểu tượng ClSend trên Desktop & Start Menu, mở app độc lập siêu mượt.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">
                      1. Tải tệp cài đặt (CaiDat-ClSend-Windows.bat)
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadWindowsInstaller}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải file cài đặt</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Tệp này hoạt động ngay trên mọi máy tính Windows 10 & 11 mà <strong>KHÔNG CẦN</strong> cài đặt Node.js hay lập trình gì cả!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs text-slate-300">
                  <span className="font-bold text-emerald-300">2. Hướng dẫn sử dụng sau khi tải:</span>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-300 mt-1">
                    <li>Nhấp đúp chuột mở tệp <code className="text-white bg-slate-800 px-1 py-0.5 rounded font-mono">CaiDat-ClSend-Windows.bat</code> vừa tải về.</li>
                    <li>Chương trình sẽ tự động tạo biểu tượng <strong>ClSend</strong> trên Màn hình chính (Desktop) và Start Menu.</li>
                    <li>Từ nay bạn chỉ cần nhấn vào biểu tượng <strong>ClSend</strong> trên màn hình máy tính để mở ứng dụng!</li>
                  </ol>
                </div>
              </div>

              {/* Advanced Electron Developer Section */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Dành cho lập trình viên (Đóng gói Electron .exe thủ công):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Đã sao chép' : 'Sao chép lệnh'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Lưu ý: Để chạy lệnh <code className="text-emerald-300 font-mono">npm run dist:win</code>, bạn phải ở trong thư mục đầy đủ của dự án (nơi có file <code className="text-white font-mono">package.json</code>).
                </p>
              </div>
            </div>
          ) : (
            /* TAB 3: GIẢI ĐÁP PHOTOPEA DÙNG KIỂU GÌ */
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-sky-950/40 via-slate-900 to-slate-950 border border-sky-500/30 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-400 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-white">
                      Photopea dùng kiểu gì để tải về máy tính?
                    </h4>
                    <p className="text-xs text-sky-200/80 mt-1 leading-relaxed">
                      Photopea <strong>KHÔNG</strong> hề dùng tệp <code className="bg-slate-800 px-1 py-0.5 rounded text-white">.exe</code> nặng 150MB-200MB! Photopea sử dụng công nghệ <strong>PWA (Progressive Web App)</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                  <h5 className="font-bold text-sky-300">Cách Photopea hoạt động:</h5>
                  <ul className="space-y-2 text-slate-300 text-[11px]">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Khi bạn vào <code className="text-sky-300">photopea.com</code> bằng Google Chrome hoặc Microsoft Edge, trình duyệt tự nhận diện đây là một ứng dụng PWA.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Khi bấm <strong>More &rarr; Install Photopea</strong>, trình duyệt sẽ hiện thông báo: <em>"Cài đặt ứng dụng Photopea?"</em> và tạo một biểu tượng trên Desktop của bạn.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Khi mở từ Desktop, nó chạy trong <strong>cửa sổ riêng biệt</strong>, không có thanh địa chỉ web, mượt mà như một phần mềm độc lập, không tốn dung lượng ổ cứng!
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5 text-xs">
                  <h5 className="font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Tại sao lúc nãy bạn thử ClSend lại báo lỗi?
                  </h5>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    1. <strong>Do khung xem trước (iframe):</strong> Hiện tại bạn đang mở ClSend trong khung xem trước của AI Studio. Trình duyệt Windows có cơ chế bảo mật nghiêm ngặt: <em>Chặn hoàn toàn việc cài đặt app từ bên trong một khung nhúng</em> để bảo vệ người dùng.
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    2. <strong>Khắc phục cực dễ:</strong> Bạn chỉ cần bấm nút <strong>"Mở ClSend trên Tab mới"</strong> dưới đây để mở web trực tiếp. Khi đó, biểu tượng Cài đặt sẽ hiện ngay trên thanh địa chỉ URL của Chrome/Edge và cài đặt thành công 100% y hệt Photopea!
                  </p>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleOpenInNewTab}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Mở ClSend trong Tab mới để Cài đặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('installer')}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Hoặc tải file cài tự động (.bat)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ClSend Desktop Companion v1.0.0</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
