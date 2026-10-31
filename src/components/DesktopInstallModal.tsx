import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Download, 
  Sparkles, 
  BellRing, 
  ExternalLink,
  Laptop,
  CheckCircle2,
  HelpCircle,
  Terminal,
  Cpu,
  Layers
} from 'lucide-react';
import { requestNotificationPermission, isPwaStandalone } from '../utils/desktopNotification';

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
  const [activeTab, setActiveTab] = useState<'pwa' | 'script' | 'electron'>('pwa');
  const [installStatusMessage, setInstallStatusMessage] = useState<string | null>(null);
  const [notificationPermissionState, setNotificationPermissionState] = useState<NotificationPermission>('default');
  const [isInIframe, setIsInIframe] = useState(false);

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

  const getDirectAppUrl = () => {
    if (typeof window === 'undefined') return 'https://clsend.app';
    return window.location.origin.split('?')[0];
  };

  const directUrl = getDirectAppUrl();

  // 1-Click Direct Desktop Setup Script Download
  const handleDownloadSetupScript = () => {
    setInstallStatusMessage('Đang tải tệp cài đặt ClSend-Desktop-Setup.cmd về máy tính...');
    try {
      const a = document.createElement('a');
      a.href = '/api/download-desktop';
      a.download = 'ClSend-Desktop-Setup.cmd';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        setInstallStatusMessage('Đã tải thành công ClSend-Desktop-Setup.cmd! Hãy nhấp đúp vào tệp vừa tải để tạo biểu tượng ClSend trên Desktop.');
      }, 1000);
    } catch (err) {
      console.warn('Direct desktop setup download error:', err);
      window.open('/api/download-desktop', '_blank');
    }
  };

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
        handleDownloadSetupScript();
      }
    } else {
      if (isInIframe) {
        setInstallStatusMessage('Đang trong môi trường xem trước nhúng. Nhấn "Mở Tab Mới" ở dưới để cài đặt PWA trực tiếp!');
      } else {
        setInstallStatusMessage('Để cài đặt 1-chạm: Trên thanh địa chỉ trình duyệt Chrome/Edge, nhấn vào biểu tượng [Cài đặt ứng dụng ⊕] ở góc phải.');
      }
    }
  };

  const handleOpenInNewTab = () => {
    try {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked', e);
    }
  };

  const handleEnableNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermissionState(perm);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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
                Trung Tâm Ứng Dụng Desktop
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Windows 10 / 11
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Chạy ClSend như ứng dụng máy tính độc lập (PWA & Desktop Shortcut)
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
          <div className="grid grid-cols-3 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pwa');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold transition-all cursor-pointer truncate ${
                activeTab === 'pwa'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">1. PWA Desktop</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('script');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold transition-all cursor-pointer truncate ${
                activeTab === 'script'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">2. Tạo Icon Desktop</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('electron');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl font-bold transition-all cursor-pointer truncate ${
                activeTab === 'electron'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="truncate">3. Electron (.exe)</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4">
          {/* Status Message Banner if triggered */}
          {installStatusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-3 shadow-xl shadow-emerald-500/10 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold text-white text-xs leading-relaxed">{installStatusMessage}</p>
                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={handleDownloadSetupScript}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải lại bộ cài Desktop Shortcut</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            /* TAB 1: PWA PHOTOPEA STYLE */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-bold text-white text-sm">
                      {isStandalone ? 'Đang chạy ở chế độ App Desktop' : 'Cài đặt trực tiếp 1-Click (Chuẩn Photopea / Zalo)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tạo ứng dụng riêng biệt chạy độc lập trên màn hình máy tính: không có thanh địa chỉ web rườm rà, có icon ClSend ngoài Desktop, ghim được vào Taskbar Windows và đăng nhập Google 100% không bị chặn.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={handleInstallPWA}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Cài đặt PWA ngay</span>
                    </button>
                  )}
                  {isInIframe && (
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Mở Tab mới để cài đặt</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Hướng dẫn cài đặt PWA trên máy tính */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5 text-xs">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  Cách trình duyệt biến ClSend thành ứng dụng Desktop:
                </h5>
                <ul className="space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">1.</span>
                    <span>Trên <strong>Google Chrome</strong> hoặc <strong>Microsoft Edge</strong>, nhìn lên góc phải thanh địa chỉ URL.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">2.</span>
                    <span>Nhấn vào biểu tượng <strong>Cài đặt ClSend (⊕)</strong> hoặc chọn Menu (3 chấm) → <em>"Ứng dụng"</em> → <em>"Cài đặt trang web này dưới dạng ứng dụng"</em>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">3.</span>
                    <span>Biểu tượng ClSend sẽ tự động xuất hiện trên màn hình Desktop và khay Taskbar như Zalo, Photoshop!</span>
                  </li>
                </ul>
              </div>

              {notificationPermissionState !== 'granted' && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <BellRing className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-200 font-medium">Bật thông báo màn hình desktop khi có tệp mới</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableNotification}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cho phép
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'script' && (
            /* TAB 2: DIRECT DESKTOP SHORTCUT SETUP SCRIPT */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/30 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-lg">
                  <Download className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    Bộ Cài Đặt Shortcut Desktop Windows
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Tải tệp cài đặt <code className="text-emerald-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">ClSend-Desktop-Setup.cmd</code> (dung lượng siêu nhẹ &lt; 5KB), nhấp đúp là tự tạo biểu tượng ClSend ngoài Desktop và mở ứng dụng ở chế độ toàn khung độc lập.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadSetupScript}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    <span>Tải ClSend-Desktop-Setup.cmd</span>
                  </button>
                </div>
              </div>

              {/* Steps guide */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5 text-xs">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Hướng dẫn cài đặt nhanh trong 5 giây:
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                  <li>Nhấn nút <strong>Tải ClSend-Desktop-Setup.cmd</strong> ở trên.</li>
                  <li>Mở tệp vừa tải về trong thư mục <strong>Downloads</strong> của máy tính (nhấp đúp để chạy).</li>
                  <li>Script tự động thiết lập biểu tượng <strong>ClSend</strong> trên Desktop máy tính và mở ứng dụng lên ngay lập tức!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'electron' && (
            /* TAB 3: ELECTRON COMPILATION FOR DEVELOPERS */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">
                    Đóng gói file .exe độc lập với Electron
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Dự án đã cấu hình sẵn mã nguồn Electron tại <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">electron/main.cjs</code> và file cấu hình <code className="text-cyan-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">package.json</code>. Bạn có thể tự đóng gói thành file <strong>ClSend-Setup.exe</strong> hoàn chỉnh bằng 2 lệnh:
                </p>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                    <span>Terminal / Command Prompt</span>
                  </div>
                  <p className="text-slate-400"># 1. Build giao diện web</p>
                  <p className="text-white font-bold">npm run build</p>
                  <p className="text-slate-400 pt-1"># 2. Đóng gói ra file ClSend.exe cài đặt trên Windows</p>
                  <p className="text-white font-bold">npm run dist:win</p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed">
                  <strong>💡 Lưu ý quan trọng:</strong> Vì Google chặn đăng nhập OAuth trên các trình duyệt nhúng của Electron, trên ứng dụng Electron người dùng nên sử dụng đăng nhập bằng <strong>Tên tài khoản & Mật khẩu</strong> hoặc <strong>Khách nhanh</strong> (như cách Zalo Desktop hoạt động).
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ClSend Desktop Suite v2.5</span>
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
