import React, { useState, useEffect } from 'react';
import { 
  X, 
  Monitor, 
  Smartphone, 
  Download, 
  Sparkles, 
  ExternalLink,
  Laptop,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Layers
} from 'lucide-react';
import QRCode from 'qrcode';
import { isPwaStandalone } from '../utils/desktopNotification';
import { useLanguage, pickLang } from '../context/LanguageContext';
import { openSafeExternalTab } from '../utils/fileDownload';

interface DesktopInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onPwaInstalled?: () => void;
  initialTab?: 'mobile' | 'pwa' | 'pc';
}

export const DesktopInstallModal: React.FC<DesktopInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onPwaInstalled,
  initialTab
}) => {
  const { currentLang } = useLanguage();
  const pick = <T,>(vi: T, en: T, zh?: T) => pickLang(currentLang, vi, en, zh);

  const isMobile = typeof window !== 'undefined' && /mobile|iphone|ipod|android/i.test(navigator.userAgent.toLowerCase());
  const isIOS = typeof window !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const [activeTab, setActiveTab] = useState<'mobile' | 'pc'>('mobile');
  const [installStatusMessage, setInstallStatusMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === 'mobile' ? 'mobile' : 'pc');
    } else {
      setActiveTab(isMobile ? 'mobile' : 'pc');
    }
  }, [initialTab, isMobile, isOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsInIframe(window.self !== window.top);
      } catch {
        setIsInIframe(true);
      }
    }
  }, [isOpen]);

  const directUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?page=landing` 
    : 'https://clsend.app';

  // Generate QR Code for Mobile Scanning
  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(directUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#020617',
          light: '#ffffff'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR generation error:', err));
    }
  }, [isOpen, directUrl]);

  if (!isOpen) return null;

  const isStandalone = isPwaStandalone();

  // 1-Click Mobile PWA Install Handler
  const handleInstallMobilePwa = async () => {
    setInstallStatusMessage(null);

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallStatusMessage(pick('Đã cài đặt ClSend thành công vào màn hình chính điện thoại!', 'ClSend installed to your phone home screen successfully!', 'ClSend 已成功安装到手机主屏幕！'));
          if (onPwaInstalled) onPwaInstalled();
        } else {
          setInstallStatusMessage(pick('Bạn đã đóng bảng cài đặt.', 'You closed the install prompt.', '您已关闭安装弹窗。'));
        }
      } catch (err) {
        console.warn('Error prompting mobile PWA install:', err);
        setInstallStatusMessage(pick('Hãy làm theo hướng dẫn 2 bước bên dưới để ghim app vào màn hình chính.', 'Follow the 2-step guide below to pin the app to your home screen.', '请按照下方 2 个步骤将应用添加到主屏幕。'));
      }
    } else {
      if (isIOS) {
        setInstallStatusMessage(pick('Trên iPhone: Hãy nhấn nút Chia sẻ [⎋] ở cuối màn hình Safari rồi chọn "Thêm vào MH chính".', 'On iPhone: Tap the Share button [⎋] at the bottom of Safari and choose "Add to Home Screen".', 'iPhone 用户：点击 Safari 底部的分享按钮 [⎋]，然后选择“添加到主屏幕”。'));
      } else if (isInIframe) {
        setInstallStatusMessage(pick('Đang mở trong khung xem trước. Hãy nhấn "Mở liên kết web" để cài 1-chạm.', 'Opened in embedded preview. Click "Open web link" for 1-tap install.', '当前为预览模式，请点击“打开网页链接”以进行一键安装。'));
      } else {
        setInstallStatusMessage(pick('Nhấn biểu tượng 3 chấm [⋮] góc trên trình duyệt Chrome, chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".', 'Tap the 3-dot menu [⋮] in Chrome and select "Install app" or "Add to Home screen".', '点击浏览器右上角菜单 [⋮]，选择“安装应用”或“添加到主屏幕”。'));
      }
    }
  };

  // 1-Click PC PWA Install Handler
  const handleInstallPWA = async () => {
    setInstallStatusMessage(null);

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstallStatusMessage(pick('Đã cài đặt thành công ClSend lên máy tính!', 'ClSend installed on your computer successfully!', 'ClSend 已成功安装到电脑！'));
          if (onPwaInstalled) onPwaInstalled();
        } else {
          setInstallStatusMessage(pick('Bạn đã hủy yêu cầu cài đặt.', 'Installation cancelled.', '您已取消安装。'));
        }
      } catch (err) {
        console.warn('Error prompting PWA install:', err);
      }
    } else {
      if (isInIframe) {
        setInstallStatusMessage(pick('Đang trong môi trường xem trước nhúng. Nhấn "Mở liên kết web" để cài đặt PWA trực tiếp!', 'Running in embedded preview. Open the direct link in a new tab to install PWA!', '当前在预览框架中，请在新标签页打开以直接安装 PWA！'));
      } else {
        setInstallStatusMessage(pick('Trên thanh địa chỉ trình duyệt Chrome/Edge, nhấn vào biểu tượng [Cài đặt ứng dụng ⊕] ở góc phải.', 'In Chrome/Edge address bar, click the [Install app ⊕] icon on the right side.', '在 Chrome/Edge 地址栏右侧点击 [安装应用 ⊕] 图标。'));
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenDirect = () => {
    openSafeExternalTab(directUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              {isMobile || activeTab === 'mobile' ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Monitor className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {isMobile
                  ? pick('Ghim ClSend Ra Màn Hình Chính', 'Pin ClSend to Home Screen', '将 ClSend 固定到主屏幕')
                  : pick('Cài Đặt ClSend (Web & PWA)', 'Install ClSend (Web & PWA)', '安装 ClSend (网页与 PWA)')}
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  {isMobile ? 'Mobile PWA' : activeTab === 'mobile' ? 'Mobile QR' : 'PC PWA'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isMobile 
                  ? pick('Ghim ứng dụng Web (PWA) trực tiếp ra màn hình chính điện thoại', 'Pin the Web App (PWA) directly to your phone home screen', '直接将网页应用 (PWA) 固定到手机主屏幕')
                  : activeTab === 'mobile'
                  ? pick('Quét mã QR để mở bản Web và cài PWA trên Android & iOS', 'Scan QR code to open on web and install PWA on Android & iOS', '扫码打开网页并在 Android 与 iOS 手机上安装 PWA')
                  : pick('Cài đặt dạng ứng dụng Web (PWA) chạy cửa sổ riêng trên Windows & macOS', 'Install as a standalone Web App (PWA) window on Windows & macOS', '在 Windows 与 macOS 上以独立 PWA 窗口运行')}
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

        {/* Tab Switcher on PC / Laptop */}
        {!isMobile && (
          <div className="px-5 sm:px-6 pt-3 pb-1 bg-slate-900">
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('mobile');
                  setInstallStatusMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                  activeTab === 'mobile'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>{pick('1. Điện Thoại (Quét QR)', '1. Mobile (Scan QR)', '1. 手机（扫码）')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('pc');
                  setInstallStatusMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                  activeTab === 'pc'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>{pick('2. Máy Tính (PC / Laptop)', '2. Computer (PC / Laptop)', '2. 电脑 (PC / 笔记本)')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="px-5 sm:px-6 py-4 overflow-y-auto space-y-4">
          
          {/* Status Message Notification if triggered */}
          {installStatusMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-start gap-2.5 shadow-lg shadow-emerald-500/10 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <p className="font-semibold text-white leading-relaxed">{installStatusMessage}</p>
            </div>
          )}

          {/* TAB 1: MOBILE */}
          {activeTab === 'mobile' && (
            <div className="space-y-4">
              {isMobile ? (
                <>
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <h4 className="font-bold text-white text-sm">
                          {pick('Cài Đặt 1-Chạm Về Điện Thoại', '1-Tap Install on Phone', '一键安装到手机')}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                        {pick('Không tốn dung lượng', 'Zero storage overhead', '无需额外空间')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {pick('Ứng dụng ClSend sẽ được ghim trực tiếp ra màn hình chính điện thoại, mở toàn màn hình không có thanh web, thông báo tệp tức thì và chạy siêu mượt.', 'ClSend will be pinned directly to your home screen for fullscreen experience, instant file notifications, and ultra-smooth performance.', 'ClSend 将直接固定到手机主屏幕，提供无地址栏全屏体验、即时文件提醒与流畅性能。')}
                    </p>

                    <button
                      id="mobile-instant-install-btn"
                      type="button"
                      onClick={handleInstallMobilePwa}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:from-emerald-600 active:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Download className="w-5 h-5 text-slate-950" />
                      <span>{pick('Cài Đặt Vào Màn Hình Chính', 'Install to Home Screen', '安装到主屏幕')}</span>
                    </button>
                  </div>

                  {isIOS ? (
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                      <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{pick('Hướng dẫn cho iPhone (Safari):', 'Instructions for iPhone (Safari):', 'iPhone (Safari) 安装指南：')}</span>
                      </h5>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                          <p>{pick('Nhấn vào biểu tượng Chia sẻ [⎋] ở thanh công cụ Safari dưới cùng.', 'Tap the Share icon [⎋] on the bottom Safari toolbar.', '点击 Safari 底部工具栏的分享图标 [⎋]。')}</p>
                        </div>
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                          <p>{pick('Cuộn xuống chọn "Thêm vào MH chính" (Add to Home Screen ➕) rồi bấm "Thêm".', 'Scroll down, tap "Add to Home Screen ➕", and confirm "Add".', '向下滚动选择“添加到主屏幕 ➕”，然后点击“添加”。')}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                      <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>{pick('Nếu không thấy bảng thông báo tự hiện:', 'If no automatic prompt appears:', '如果未出现自动安装提示：')}</span>
                      </h5>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                          <p>{pick('Bấm nút 3 dấu chấm [⋮] ở góc trên bên phải trình duyệt Chrome/Edge.', 'Tap the 3-dot button [⋮] at the top right corner of Chrome/Edge.', '点击 Chrome/Edge 浏览器右上角的菜单按钮 [⋮]。')}</p>
                        </div>
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                          <p>{pick('Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".', 'Select "Install app" or "Add to Home screen".', '选择“安装应用”或“添加到主屏幕”。')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 flex flex-col items-center text-center space-y-4 shadow-xl">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{pick('Quét mã bằng Camera điện thoại', 'Scan with your Phone Camera', '使用手机相机扫码')}</span>
                  </div>

                  {qrDataUrl ? (
                    <div className="p-3.5 bg-white rounded-3xl shadow-2xl shadow-emerald-500/15 border-4 border-slate-800/90 hover:border-emerald-500/50 transition-colors">
                      <img 
                        src={qrDataUrl} 
                        alt="QR Code" 
                        className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-2xl" 
                      />
                    </div>
                  ) : (
                    <div className="w-52 h-52 sm:w-56 sm:h-56 bg-slate-800 rounded-3xl flex items-center justify-center animate-pulse text-slate-500 text-xs">
                      {pick('Đang tạo mã QR...', 'Generating QR code...', '正在生成二维码...')}
                    </div>
                  )}

                  <div className="space-y-1 max-w-sm">
                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                      {pick('Mở ứng dụng Camera trên điện thoại (iPhone hoặc Android) quét mã bên trên để tải ứng dụng về máy ngay lập tức.', 'Open the Camera app on iPhone or Android and scan above to launch and install immediately.', '打开 iPhone 或 Android 手机相机扫描上方二维码即可立即使用和安装。')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {pick('Tự động lưu vào màn hình chính, mở nhanh không cần tải file cài đặt phức tạp.', 'Adds cleanly to home screen without complex installer files.', '自动保存到主屏幕，无需复杂安装包即可快速打开。')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedLink ? pick('Đã sao chép liên kết!', 'Link copied!', '已复制链接！') : pick('Sao chép link tải', 'Copy download link', '复制下载链接')}</span>
                    </button>

                    {isInIframe && (
                      <button
                        type="button"
                        onClick={handleOpenDirect}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{pick('Mở liên kết web', 'Open web link', '打开网页链接')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PC */}
          {activeTab === 'pc' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap sm:flex-nowrap">
                    <span className="font-bold text-white text-sm">
                      {isStandalone
                        ? pick('Đang chạy ở chế độ App Desktop', 'Running in Desktop App Mode', '正在桌面应用模式下运行')
                        : pick('Cài đặt trực tiếp 1-Click (PWA Desktop)', '1-Click Direct Install (PWA Desktop)', '一键直接安装 (PWA 桌面版)')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      {pick('Khuyên dùng', 'Recommended', '推荐使用')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {pick('Tạo ứng dụng riêng biệt chạy độc lập trên màn hình máy tính: không có thanh địa chỉ web, có icon ClSend ngoài Desktop, ghim được vào Taskbar Windows.', 'Creates a standalone desktop window with no address bar, desktop icon, and Windows Taskbar pinning.', '创建独立的桌面应用窗口：无浏览器地址栏，支持桌面图标与任务栏固定。')}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                  {!isStandalone && (
                    <button
                      type="button"
                      onClick={handleInstallPWA}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>{pick('Cài Đặt Lên PC Ngay', 'Install to PC Now', '立即安装到电脑')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Direct Desktop Shortcut Script (.cmd) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-white">{pick('Tải bộ tạo biểu tượng Desktop (.cmd)', 'Download Desktop Shortcut Creator (.cmd)', '下载桌面快捷方式创建器 (.cmd)')}</h5>
                  <p className="text-[11px] text-slate-400">{pick('Tự động tạo shortcut ClSend với icon sắc nét ngoài Desktop Windows 10/11', 'Automatically creates a crisp ClSend shortcut on your Windows 10/11 Desktop', '自动在 Windows 10/11 桌面创建高清 ClSend 快捷方式')}</p>
                </div>
                <a
                  href="/api/download-desktop"
                  download="ClSend-Desktop-Setup.cmd"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  {pick('Tải .cmd', 'Get .cmd', '下载 .cmd')}
                </a>
              </div>

              {/* Landing preview */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.location.href = '/?page=landing';
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{pick('Mở Trang Giới Thiệu (ClSend Web & PWA)', 'Open Overview Page (ClSend Web & PWA)', '打开详细介绍页 (ClSend Web & PWA)')}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{pick('Mã hóa bảo mật P2P & Lưu trữ Cloud', 'Encrypted P2P & Cloud Storage', '加密 P2P 传输与云端存储')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            {pick('Đóng', 'Close', '关闭')}
          </button>
        </div>
      </div>
    </div>
  );
};
