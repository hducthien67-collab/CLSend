import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Download, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  BellRing, 
  ExternalLink,
  Laptop,
  CheckCircle2,
  HelpCircle
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
  const [activeTab, setActiveTab] = useState<'exe' | 'pwa'>('exe');
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

  // 1-Click Direct .exe Installer Download
  const handleDownloadExe = () => {
    setInstallStatusMessage('Đang tải tệp cài đặt ClSend-Setup.exe về máy tính...');
    try {
      const a = document.createElement('a');
      a.href = '/api/download-exe';
      a.download = 'ClSend-Setup.exe';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        setInstallStatusMessage('Đã tải thành công ClSend-Setup.exe! Hãy mở tệp vừa tải ở mục Downloads để cài đặt ứng dụng lên Desktop.');
      }, 1000);
    } catch (err) {
      console.warn('Direct exe download error:', err);
      // Fallback
      window.open('/api/download-exe', '_blank');
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
        handleDownloadExe();
      }
    } else {
      handleDownloadExe();
      setInstallStatusMessage(
        'Đã tải tệp ClSend-Setup.exe về máy của bạn! Hãy nhấp đúp vào tệp vừa tải để cài đặt ứng dụng ClSend độc lập lên Desktop.'
      );
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
                Tải ứng dụng ClSend (.exe)
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Windows 10 / 11
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Nhấn 1 lần để tải tệp cài đặt <code className="text-emerald-300 font-mono">ClSend-Setup.exe</code>
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
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('exe');
                setInstallStatusMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'exe'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Tải file .exe trực tiếp</span>
            </button>

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
              <span>Cài nhanh như Photopea</span>
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
                    onClick={handleDownloadExe}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải lại file ClSend-Setup.exe</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exe' ? (
            /* TAB 1: DIRECT .EXE DOWNLOAD */
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/30 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-lg">
                  <Download className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">
                    Trình cài đặt ứng dụng ClSend cho Windows
                  </h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Tải ngay tệp <code className="text-emerald-300 font-mono bg-slate-950 px-1.5 py-0.5 rounded">ClSend-Setup.exe</code> để cài đặt trực tiếp phần mềm vào máy tính, tạo biểu tượng trên màn hình Desktop tiện lợi.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadExe}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    <span>Tải xuống ClSend-Setup.exe</span>
                  </button>
                </div>
              </div>

              {/* Steps guide */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5 text-xs">
                <h5 className="font-bold text-white flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Hướng dẫn cài đặt:
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                  <li>Nhấn nút <strong>Tải xuống ClSend-Setup.exe</strong> ở trên.</li>
                  <li>Mở tệp vừa tải về trong thư mục <strong>Downloads</strong> của máy tính.</li>
                  <li>Thực hiện theo các bước trên hộp thoại cài đặt để hoàn tất và mở ứng dụng.</li>
                </ol>
              </div>
            </div>
          ) : (
            /* TAB 2: PWA PHOTOPEA STYLE */
            <div className="space-y-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-bold text-white text-sm">
                      {isStandalone ? 'Đang chạy ở chế độ App' : 'Cài đặt trực tiếp 1-Click (Photopea style)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      Không cần tải file nặng
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Biến trang web thành ứng dụng desktop riêng biệt ngay trên trình duyệt mà không cần cài đặt phức tạp.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={handleInstallPWA}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
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
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ClSend Setup v1.0.0</span>
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
