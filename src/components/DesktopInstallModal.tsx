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
  const isMobile = typeof window !== 'undefined' && /mobile|iphone|ipod|android/i.test(navigator.userAgent.toLowerCase());
  const isIOS = typeof window !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent.toLowerCase());

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
          setInstallStatusMessage('Đã cài đặt CLSend thành công vào màn hình chính điện thoại!');
          if (onPwaInstalled) onPwaInstalled();
        } else {
          setInstallStatusMessage('Bạn đã đóng bảng cài đặt.');
        }
      } catch (err) {
        console.warn('Error prompting mobile PWA install:', err);
        setInstallStatusMessage('Hãy làm theo hướng dẫn 2 bước bên dưới để ghim app vào màn hình chính.');
      }
    } else {
      if (isIOS) {
        setInstallStatusMessage('Trên iPhone: Hãy nhấn nút Chia sẻ [⎋] ở cuối màn hình Safari rồi chọn "Thêm vào MH chính".');
      } else if (isInIframe) {
        setInstallStatusMessage('Đang mở trong khung xem trước. Hãy nhấn "Mở trên trình duyệt điện thoại" để cài 1-chạm.');
      } else {
        setInstallStatusMessage('Nhấn biểu tượng 3 chấm [⋮] góc trên trình duyệt Chrome, chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".');
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
          setInstallStatusMessage('Đã cài đặt thành công CLSend lên máy tính!');
          if (onPwaInstalled) onPwaInstalled();
        } else {
          setInstallStatusMessage('Bạn đã hủy yêu cầu cài đặt.');
        }
      } catch (err) {
        console.warn('Error prompting PWA install:', err);
      }
    } else {
      if (isInIframe) {
        setInstallStatusMessage('Đang trong môi trường xem trước nhúng. Nhấn "Mở Tab Mới" ở dưới để cài đặt PWA trực tiếp!');
      } else {
        setInstallStatusMessage('Trên thanh địa chỉ trình duyệt Chrome/Edge, nhấn vào biểu tượng [Cài đặt ứng dụng ⊕] ở góc phải.');
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenDirect = () => {
    try {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Popup blocked', e);
    }
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
                {isMobile ? 'Cài Đặt CLSend Vào Điện Thoại' : 'Tải & Cài Đặt CLSend'}
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  {isMobile ? 'Mobile App' : activeTab === 'mobile' ? 'Mobile QR' : 'PC Desktop'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {isMobile 
                  ? 'Ghim ứng dụng trực tiếp ra màn hình chính điện thoại' 
                  : activeTab === 'mobile'
                  ? 'Quét mã để cài đặt ứng dụng trên điện thoại Android & iOS'
                  : 'Chạy độc lập trên máy tính Windows, Mac & Web'}
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

        {/* Tab Switcher: Chỉ hiển thị trên Máy tính (PC / Laptop) - Ẩn hoàn toàn trên Điện thoại */}
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
                <span>1. Điện Thoại (Quét QR)</span>
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
                <span>2. Máy Tính (PC / Laptop)</span>
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

          {/* TAB 1: ĐIỆN THOẠI */}
          {activeTab === 'mobile' && (
            <div className="space-y-4">
              {isMobile ? (
                /* ======================================================== */
                /* TRƯỜNG HỢP 1: NGƯỜI DÙNG ĐANG CẦM ĐIỆN THOẠI TRÊN TAY     */
                /* ======================================================== */
                <>
                  {/* Nút 1-chạm cài đặt vào điện thoại */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <h4 className="font-bold text-white text-sm">
                          Cài Đặt 1-Chạm Về Điện Thoại
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
                        Không tốn dung lượng
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ứng dụng CLSend sẽ được ghim trực tiếp ra màn hình chính điện thoại, mở toàn màn hình không có thanh web, thông báo tệp tức thì và chạy siêu mượt.
                    </p>

                    <button
                      id="mobile-instant-install-btn"
                      type="button"
                      onClick={handleInstallMobilePwa}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:from-emerald-600 active:to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Download className="w-5 h-5 text-slate-950" />
                      <span>Cài Đặt Vào Màn Hình Chính</span>
                    </button>
                  </div>

                  {/* Hướng dẫn chi tiết cho iOS Safari hoặc Android */}
                  {isIOS ? (
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                      <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Hướng dẫn cho iPhone (Safari):</span>
                      </h5>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                          <p>Nhấn vào biểu tượng <strong>Chia sẻ [⎋]</strong> ở thanh công cụ Safari dưới cùng.</p>
                        </div>
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                          <p>Cuộn xuống chọn <strong>"Thêm vào MH chính" (Add to Home Screen ➕)</strong> rồi bấm <strong>"Thêm"</strong>.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                      <h5 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Nếu không thấy bảng thông báo tự hiện:</span>
                      </h5>
                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                          <p>Bấm nút <strong>3 dấu chấm [⋮]</strong> ở góc trên bên phải trình duyệt Chrome/Edge.</p>
                        </div>
                        <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                          <p>Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ======================================================== */
                /* TRƯỜNG HỢP 2: NGƯỜI DÙNG ĐANG TRÊN MÁY TÍNH (PC / LAPTOP) */
                /* CÁI CẦN TO: MÃ QR CODE TO, RÕ RÀNG Ở GIỮA ĐỂ DỄ DÀNG QUÉT  */
                /* ======================================================== */
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 flex flex-col items-center text-center space-y-4 shadow-xl">
                  {/* Badge hướng dẫn */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Quét mã bằng Camera điện thoại hoặc Zalo</span>
                  </div>

                  {/* Mã QR TO RÕ RÀNG, ĐẸP MẮT Ở GIỮA */}
                  {qrDataUrl ? (
                    <div className="p-3.5 bg-white rounded-3xl shadow-2xl shadow-emerald-500/15 border-4 border-slate-800/90 hover:border-emerald-500/50 transition-colors">
                      <img 
                        src={qrDataUrl} 
                        alt="QR Code Cài đặt CLSend về Điện Thoại" 
                        className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-2xl" 
                      />
                    </div>
                  ) : (
                    <div className="w-52 h-52 sm:w-56 sm:h-56 bg-slate-800 rounded-3xl flex items-center justify-center animate-pulse text-slate-500 text-xs">
                      Đang tạo mã QR...
                    </div>
                  )}

                  {/* Lời giải thích ngắn gọn, rõ ràng */}
                  <div className="space-y-1 max-w-sm">
                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                      Mở ứng dụng <strong>Camera</strong> hoặc <strong>Zalo</strong> trên điện thoại (iPhone hoặc Android) quét mã bên trên để tải ứng dụng về máy ngay lập tức.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Tự động lưu vào màn hình chính, mở nhanh không cần tải file cài đặt phức tạp.
                    </p>
                  </div>

                  {/* Các nút hành động phụ tiện ích */}
                  <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedLink ? 'Đã sao chép liên kết!' : 'Sao chép link tải'}</span>
                    </button>

                    {isInIframe && (
                      <button
                        type="button"
                        onClick={handleOpenDirect}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở liên kết web</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MÁY TÍNH (PC / LAPTOP WINDOWS & MAC) */}
          {activeTab === 'pc' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap sm:flex-nowrap">
                    <span className="font-bold text-white text-sm">
                      {isStandalone ? 'Đang chạy ở chế độ App Desktop' : 'Cài đặt trực tiếp 1-Click (PWA Desktop)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tạo ứng dụng riêng biệt chạy độc lập trên màn hình máy tính: không có thanh địa chỉ web, có icon CLSend ngoài Desktop, ghim được vào Taskbar Windows.
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
                      <span>Cài Đặt Lên PC Ngay</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Direct Desktop Shortcut Script (.cmd) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-white">Tải bộ tạo biểu tượng Desktop (.cmd)</h5>
                  <p className="text-[11px] text-slate-400">Tự động tạo shortcut CLSend với icon sắc nét ngoài Desktop Windows 10/11</p>
                </div>
                <a
                  href="/api/download-desktop"
                  download="ClSend-Desktop-Setup.cmd"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  Tải .cmd
                </a>
              </div>

              {/* Nút xem Trang Giới Thiệu PC */}
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
                  <span>Mở Trang Giới Thiệu Chi Tiết (CLSend PC)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mã hóa bảo mật P2P & Lưu trữ Cloud</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
